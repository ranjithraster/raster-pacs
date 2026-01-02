package in.raster.rasterpacs.service.settings;

import in.raster.rasterpacs.dto.PacsNodeDto;
import in.raster.rasterpacs.model.PacsNode;
import in.raster.rasterpacs.repository.PacsNodeRepository;
import in.raster.rasterpacs.config.DicomLocalProperties;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.UID;
import org.dcm4che3.data.VR;
import org.dcm4che3.net.*;
import org.dcm4che3.net.pdu.AAssociateRQ;
import org.dcm4che3.net.pdu.PresentationContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executors;

/**
 * Service for managing PACS node settings
 */
@Slf4j
@Service
public class SettingsService {

    private final PacsNodeRepository pacsNodeRepository;
    private final DicomLocalProperties localProperties;

    public SettingsService(PacsNodeRepository pacsNodeRepository,
                           DicomLocalProperties localProperties) {
        this.pacsNodeRepository = pacsNodeRepository;
        this.localProperties = localProperties;
    }

    // ==================== PACS Node Management ====================

    /**
     * Get all PACS nodes
     */
    public List<PacsNodeDto> getAllPacsNodes() {
        return pacsNodeRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    /**
     * Get active PACS nodes
     */
    public List<PacsNodeDto> getActivePacsNodes() {
        return pacsNodeRepository.findByIsActiveTrueOrderByNameAsc().stream()
            .map(this::toDto)
            .toList();
    }

    /**
     * Get PACS node by name
     */
    public Optional<PacsNodeDto> getPacsNode(String name) {
        return pacsNodeRepository.findByName(name).map(this::toDto);
    }

    /**
     * Create a new PACS node
     */
    @Transactional
    public PacsNode createPacsNode(PacsNodeDto dto) {
        if (pacsNodeRepository.existsByName(dto.getName())) {
            throw new IllegalArgumentException("PACS node with name '" + dto.getName() + "' already exists");
        }

        PacsNode node = new PacsNode();
        updateFromDto(node, dto);

        // If this is the first node or marked as default, make it default
        if (dto.isDefault() || pacsNodeRepository.count() == 0) {
            clearDefaultNode();
            node.setDefault(true);
        }

        log.info("Created PACS node: {} ({}@{}:{})",
            node.getName(), node.getAeTitle(), node.getHostname(), node.getPort());

        return pacsNodeRepository.save(node);
    }

    /**
     * Update a PACS node
     */
    @Transactional
    public PacsNode updatePacsNode(Long id, PacsNodeDto dto) {
        PacsNode node = pacsNodeRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("PACS node not found: " + id));

        updateFromDto(node, dto);

        if (dto.isDefault()) {
            clearDefaultNode();
            node.setDefault(true);
        }

        log.info("Updated PACS node: {}", node.getName());
        return pacsNodeRepository.save(node);
    }

    /**
     * Delete a PACS node
     */
    @Transactional
    public void deletePacsNode(Long id) {
        PacsNode node = pacsNodeRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("PACS node not found: " + id));

        log.info("Deleted PACS node: {}", node.getName());
        pacsNodeRepository.delete(node);
    }

    /**
     * Set a node as default
     */
    @Transactional
    public void setDefaultNode(Long id) {
        clearDefaultNode();

        PacsNode node = pacsNodeRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("PACS node not found: " + id));

        node.setDefault(true);
        pacsNodeRepository.save(node);
    }

    /**
     * Test connection to a PACS node
     */
    public Map<String, Object> testConnection(Long id) {
        PacsNode node = pacsNodeRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("PACS node not found: " + id));

        return testConnection(node);
    }

    /**
     * Test connection with provided settings (without saving)
     */
    public Map<String, Object> testConnection(PacsNodeDto dto) {
        PacsNode tempNode = new PacsNode();
        updateFromDto(tempNode, dto);
        return testConnection(tempNode);
    }

    private Map<String, Object> testConnection(PacsNode node) {
        log.info("Testing connection to PACS: {} ({}@{}:{})",
            node.getName(), node.getAeTitle(), node.getHostname(), node.getPort());

        long startTime = System.currentTimeMillis();
        String result;
        String message;

        try {
            // Create connection
            Device device = new Device("test-device");
            Connection conn = new Connection();
            conn.setHostname(node.getHostname());
            conn.setPort(node.getPort());
            device.addConnection(conn);

            ApplicationEntity ae = new ApplicationEntity(localProperties.getAeTitle());
            ae.addConnection(conn);
            device.addApplicationEntity(ae);

            // Create association request
            AAssociateRQ rq = new AAssociateRQ();
            rq.setCalledAET(node.getAeTitle());
            rq.setCallingAET(localProperties.getAeTitle());
            rq.addPresentationContext(new PresentationContext(
                1, UID.Verification, UID.ImplicitVRLittleEndian));

            // Try to connect
            Connection remoteConn = new Connection();
            remoteConn.setHostname(node.getHostname());
            remoteConn.setPort(node.getPort());

            Association as = ae.connect(remoteConn, rq);

            // Send C-ECHO
            as.cecho().next();
            as.release();

            result = "SUCCESS";
            message = "Connection successful - C-ECHO verified";
            log.info("PACS test successful: {}", node.getName());

        } catch (Exception e) {
            result = "FAILED";
            message = e.getMessage();
            log.error("PACS test failed: {} - {}", node.getName(), e.getMessage());
        }

        long elapsed = System.currentTimeMillis() - startTime;

        // Update node with test result
        if (node.getId() != null) {
            node.setLastTestedAt(LocalDateTime.now());
            node.setLastTestResult(result);
            node.setLastTestMessage(message);
            pacsNodeRepository.save(node);
        }

        return Map.of(
            "success", "SUCCESS".equals(result),
            "result", result,
            "message", message,
            "responseTimeMs", elapsed
        );
    }

    // ==================== Local Settings ====================

    /**
     * Get local AE settings
     */
    public Map<String, Object> getLocalSettings() {
        return Map.of(
            "aeTitle", localProperties.getAeTitle(),
            "hostname", localProperties.getEffectivePublicHostname(),
            "bindAddress", localProperties.getEffectiveBindAddress(),
            "port", localProperties.getPort()
        );
    }

    // ==================== Helper Methods ====================

    private void clearDefaultNode() {
        pacsNodeRepository.findByIsDefaultTrue().ifPresent(node -> {
            node.setDefault(false);
            pacsNodeRepository.save(node);
        });
    }

    private void updateFromDto(PacsNode node, PacsNodeDto dto) {
        node.setName(dto.getName());
        node.setAeTitle(dto.getAeTitle());
        node.setHostname(dto.getHostname());
        node.setPort(dto.getPort());
        node.setDescription(dto.getDescription());
        node.setQueryRetrieveLevel(dto.getQueryRetrieveLevel() != null ?
            dto.getQueryRetrieveLevel() : "STUDY");
        node.setActive(dto.isActive());
    }

    private PacsNodeDto toDto(PacsNode node) {
        return PacsNodeDto.builder()
            .name(node.getName())
            .aeTitle(node.getAeTitle())
            .hostname(node.getHostname())
            .port(node.getPort())
            .description(node.getDescription())
            .queryRetrieveLevel(node.getQueryRetrieveLevel())
            .isDefault(node.isDefault())
            .isActive(node.isActive())
            .build();
    }
}

