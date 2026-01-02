package in.raster.rasterpacs.config;

import org.dcm4che3.net.Device;
import org.dcm4che3.net.Connection;
import org.dcm4che3.net.ApplicationEntity;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

/**
 * DICOM Configuration - dcm4che Device and network beans
 */
@Configuration
@EnableAsync
@EnableScheduling
public class DicomConfiguration {

    private final DicomLocalProperties localProperties;

    public DicomConfiguration(DicomLocalProperties localProperties) {
        this.localProperties = localProperties;
    }

    /**
     * Create the main dcm4che Device
     */
    @Bean
    public Device dicomDevice(ExecutorService dicomExecutor, ScheduledExecutorService dicomScheduledExecutor) {
        Device device = new Device(localProperties.getAeTitle());

        // Create connection - bind to local address
        Connection connection = new Connection();
        connection.setHostname(localProperties.getEffectiveBindAddress());
        connection.setPort(localProperties.getPort());
        connection.setSocketCloseDelay(50);
        device.addConnection(connection);

        // Create Application Entity
        ApplicationEntity ae = new ApplicationEntity(localProperties.getAeTitle());
        ae.setAssociationAcceptor(true);
        ae.setAssociationInitiator(true);
        ae.addConnection(connection);
        device.addApplicationEntity(ae);

        // Set executor services
        device.setExecutor(dicomExecutor);
        device.setScheduledExecutor(dicomScheduledExecutor);

        return device;
    }

    /**
     * Executor service for DICOM operations
     */
    @Bean(name = "dicomExecutor")
    @Primary
    public ExecutorService dicomExecutor() {
        return Executors.newCachedThreadPool();
    }

    /**
     * Scheduled executor for DICOM timeouts
     */
    @Bean(name = "dicomScheduledExecutor")
    public ScheduledExecutorService dicomScheduledExecutor() {
        return Executors.newSingleThreadScheduledExecutor();
    }

    /**
     * Async task executor for background operations
     */
    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("dicom-async-");
        // Use CallerRunsPolicy to handle overflow - runs task in calling thread instead of rejecting
        executor.setRejectedExecutionHandler(new java.util.concurrent.ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}

