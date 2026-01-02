package in.raster.rasterpacs.controller;

import in.raster.rasterpacs.dto.PacsNodeDto;
import in.raster.rasterpacs.model.PacsNode;
import in.raster.rasterpacs.service.settings.SettingsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for application settings
 */
@Slf4j
@RestController
@RequestMapping("/api/settings")
@CrossOrigin(origins = "*")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    // ==================== PACS Nodes ====================

    /**
     * Get all PACS nodes
     */
    @GetMapping("/pacs")
    public ResponseEntity<List<PacsNodeDto>> getAllPacsNodes() {
        return ResponseEntity.ok(settingsService.getAllPacsNodes());
    }

    /**
     * Get active PACS nodes
     */
    @GetMapping("/pacs/active")
    public ResponseEntity<List<PacsNodeDto>> getActivePacsNodes() {
        return ResponseEntity.ok(settingsService.getActivePacsNodes());
    }

    /**
     * Get PACS node by name
     */
    @GetMapping("/pacs/{name}")
    public ResponseEntity<PacsNodeDto> getPacsNode(@PathVariable String name) {
        return settingsService.getPacsNode(name)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new PACS node
     */
    @PostMapping("/pacs")
    public ResponseEntity<?> createPacsNode(@RequestBody PacsNodeDto dto) {
        log.info("Creating PACS node: {}", dto.getName());

        try {
            PacsNode node = settingsService.createPacsNode(dto);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "success", true,
                "message", "PACS node created successfully",
                "node", dto
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Error creating PACS node", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "Failed to create PACS node: " + e.getMessage()
            ));
        }
    }

    /**
     * Update a PACS node
     */
    @PutMapping("/pacs/{id}")
    public ResponseEntity<?> updatePacsNode(@PathVariable Long id, @RequestBody PacsNodeDto dto) {
        log.info("Updating PACS node: {}", id);

        try {
            PacsNode node = settingsService.updatePacsNode(id, dto);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "PACS node updated successfully"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error updating PACS node", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "Failed to update PACS node: " + e.getMessage()
            ));
        }
    }

    /**
     * Delete a PACS node
     */
    @DeleteMapping("/pacs/{id}")
    public ResponseEntity<?> deletePacsNode(@PathVariable Long id) {
        log.info("Deleting PACS node: {}", id);

        try {
            settingsService.deletePacsNode(id);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "PACS node deleted successfully"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error deleting PACS node", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "success", false,
                "message", "Failed to delete PACS node: " + e.getMessage()
            ));
        }
    }

    /**
     * Set a node as default
     */
    @PostMapping("/pacs/{id}/default")
    public ResponseEntity<?> setDefaultNode(@PathVariable Long id) {
        try {
            settingsService.setDefaultNode(id);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Default PACS node updated"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Test connection to a saved PACS node
     */
    @PostMapping("/pacs/{id}/test")
    public ResponseEntity<Map<String, Object>> testConnection(@PathVariable Long id) {
        log.info("Testing PACS connection: {}", id);

        try {
            Map<String, Object> result = settingsService.testConnection(id);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error testing PACS connection", e);
            return ResponseEntity.ok(Map.of(
                "success", false,
                "result", "ERROR",
                "message", e.getMessage()
            ));
        }
    }

    /**
     * Test connection with provided settings (without saving)
     */
    @PostMapping("/pacs/test")
    public ResponseEntity<Map<String, Object>> testConnectionSettings(@RequestBody PacsNodeDto dto) {
        log.info("Testing PACS connection to: {}@{}:{}", dto.getAeTitle(), dto.getHostname(), dto.getPort());

        try {
            Map<String, Object> result = settingsService.testConnection(dto);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error testing PACS connection", e);
            return ResponseEntity.ok(Map.of(
                "success", false,
                "result", "ERROR",
                "message", e.getMessage()
            ));
        }
    }

    // ==================== Local Settings ====================

    /**
     * Get local AE settings
     */
    @GetMapping("/local")
    public ResponseEntity<Map<String, Object>> getLocalSettings() {
        return ResponseEntity.ok(settingsService.getLocalSettings());
    }
}

