package in.raster.rasterpacs.controller;

import in.raster.rasterpacs.config.PacsNodeProperties;
import in.raster.rasterpacs.dto.PacsNodeDto;
import in.raster.rasterpacs.service.pacs.PacsConnectionFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * REST Controller for PACS node management
 */
@Slf4j
@RestController
@RequestMapping("/api/pacs")
@CrossOrigin(origins = "*")
public class PacsController {

    private final PacsNodeProperties pacsNodeProperties;
    private final PacsConnectionFactory connectionFactory;

    public PacsController(PacsNodeProperties pacsNodeProperties,
                         PacsConnectionFactory connectionFactory) {
        this.pacsNodeProperties = pacsNodeProperties;
        this.connectionFactory = connectionFactory;
    }

    /**
     * Get all configured PACS nodes
     */
    @GetMapping("/nodes")
    public ResponseEntity<List<PacsNodeDto>> getNodes() {
        List<PacsNodeDto> nodes = pacsNodeProperties.getNodes().stream()
                .map(node -> PacsNodeDto.builder()
                        .name(node.getName())
                        .aeTitle(node.getAeTitle())
                        .hostname(node.getHostname())
                        .port(node.getPort())
                        .description(node.getDescription())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(nodes);
    }

    /**
     * Get a specific PACS node by name
     */
    @GetMapping("/nodes/{name}")
    public ResponseEntity<PacsNodeDto> getNode(@PathVariable String name) {
        PacsNodeProperties.PacsNode node = pacsNodeProperties.getNodeByName(name);

        if (node == null) {
            return ResponseEntity.notFound().build();
        }

        PacsNodeDto dto = PacsNodeDto.builder()
                .name(node.getName())
                .aeTitle(node.getAeTitle())
                .hostname(node.getHostname())
                .port(node.getPort())
                .description(node.getDescription())
                .build();

        return ResponseEntity.ok(dto);
    }

    /**
     * Verify PACS connectivity using C-ECHO
     */
    @GetMapping("/nodes/{name}/echo")
    public ResponseEntity<PacsNodeDto> echoNode(@PathVariable String name) {
        PacsNodeProperties.PacsNode node = pacsNodeProperties.getNodeByName(name);

        if (node == null) {
            return ResponseEntity.notFound().build();
        }

        boolean online = connectionFactory.echo(name);

        PacsNodeDto dto = PacsNodeDto.builder()
                .name(node.getName())
                .aeTitle(node.getAeTitle())
                .hostname(node.getHostname())
                .port(node.getPort())
                .description(node.getDescription())
                .online(online)
                .echoStatus(online ? "SUCCESS" : "FAILED")
                .build();

        log.info("C-ECHO to {} ({}:{}): {}",
                node.getName(), node.getHostname(), node.getPort(),
                online ? "SUCCESS" : "FAILED");

        return ResponseEntity.ok(dto);
    }

    /**
     * Verify all PACS nodes connectivity
     */
    @GetMapping("/nodes/echo-all")
    public ResponseEntity<List<PacsNodeDto>> echoAllNodes() {
        List<PacsNodeDto> results = pacsNodeProperties.getNodes().stream()
                .map(node -> {
                    boolean online = connectionFactory.echo(node.getName());
                    return PacsNodeDto.builder()
                            .name(node.getName())
                            .aeTitle(node.getAeTitle())
                            .hostname(node.getHostname())
                            .port(node.getPort())
                            .description(node.getDescription())
                            .online(online)
                            .echoStatus(online ? "SUCCESS" : "FAILED")
                            .build();
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(results);
    }
}

