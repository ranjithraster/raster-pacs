package in.raster.rasterpacs;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import in.raster.rasterpacs.config.CacheProperties;
import in.raster.rasterpacs.config.DicomLocalProperties;
import in.raster.rasterpacs.config.PacsNodeProperties;

@SpringBootApplication
@EnableConfigurationProperties({
    PacsNodeProperties.class,
    CacheProperties.class,
    DicomLocalProperties.class
})
@EnableAsync
@EnableScheduling
public class RasterPacsApplication {

    public static void main(String[] args) {
        SpringApplication.run(RasterPacsApplication.class, args);
    }

}
