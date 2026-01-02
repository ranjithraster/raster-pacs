package in.raster.rasterpacs.service.report;

import in.raster.rasterpacs.model.ReportTemplate;
import in.raster.rasterpacs.repository.ReportTemplateRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Initializes default report templates on application startup
 */
@Slf4j
@Component
public class DefaultTemplateInitializer implements CommandLineRunner {

    private final ReportTemplateRepository templateRepository;

    public DefaultTemplateInitializer(ReportTemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    @Override
    public void run(String... args) {
        if (templateRepository.count() == 0) {
            log.info("Initializing default report templates...");
            createDefaultTemplates();
            log.info("Created {} default templates", templateRepository.count());
        }
    }

    private void createDefaultTemplates() {
        // CT Chest Template
        templateRepository.save(ReportTemplate.builder()
            .templateId("CT-CHEST-001")
            .name("CT Chest Standard")
            .description("Standard template for CT Chest examinations")
            .category("CT")
            .modality("CT")
            .bodyPart("CHEST")
            .isActive(true)
            .isDefault(true)
            .sortOrder(1)
            .defaultTechnique("CT of the chest was performed with IV contrast. Axial images were obtained from the thoracic inlet through the adrenal glands. Multiplanar reformations were reviewed.")
            .defaultFindings("""
                LUNGS: The lungs are clear without focal consolidation, mass, or nodule. No pleural effusion or pneumothorax.
                
                AIRWAYS: The trachea and main bronchi are patent.
                
                MEDIASTINUM: Heart size is normal. No pericardial effusion. The thoracic aorta is normal in caliber.
                
                LYMPH NODES: No enlarged mediastinal or hilar lymph nodes.
                
                CHEST WALL: No chest wall mass or bone lesion.
                
                UPPER ABDOMEN: Limited evaluation of the upper abdomen demonstrates no gross abnormality.""")
            .defaultImpression("No acute cardiopulmonary abnormality.")
            .macros("""
                [{"shortcut":"naf","expansion":"No acute findings.","category":"general"},
                 {"shortcut":"wnl","expansion":"Within normal limits.","category":"general"},
                 {"shortcut":"neg","expansion":"Negative for acute abnormality.","category":"general"},
                 {"shortcut":"npe","expansion":"No pleural effusion.","category":"chest"},
                 {"shortcut":"nptx","expansion":"No pneumothorax.","category":"chest"}]""")
            .build());

        // CT Abdomen Template
        templateRepository.save(ReportTemplate.builder()
            .templateId("CT-ABD-001")
            .name("CT Abdomen/Pelvis")
            .description("Standard template for CT Abdomen and Pelvis")
            .category("CT")
            .modality("CT")
            .bodyPart("ABDOMEN")
            .isActive(true)
            .isDefault(false)
            .sortOrder(2)
            .defaultTechnique("CT of the abdomen and pelvis was performed with oral and IV contrast.")
            .defaultFindings("""
                LIVER: Normal size and attenuation. No focal lesion.
                
                GALLBLADDER AND BILIARY: Gallbladder is normal. No biliary ductal dilatation.
                
                PANCREAS: Normal in size and attenuation.
                
                SPLEEN: Normal size.
                
                ADRENALS: Normal.
                
                KIDNEYS: Normal size, shape, and enhancement. No hydronephrosis or stone.
                
                GI TRACT: No bowel obstruction or wall thickening.
                
                BLADDER: Normal.
                
                LYMPH NODES: No enlarged abdominal or pelvic lymph nodes.
                
                VASCULATURE: Aorta and IVC are normal.
                
                BONES: No suspicious osseous lesion.""")
            .defaultImpression("No acute abdominal or pelvic abnormality.")
            .build());

        // MRI Brain Template
        templateRepository.save(ReportTemplate.builder()
            .templateId("MRI-BRAIN-001")
            .name("MRI Brain Standard")
            .description("Standard template for MRI Brain examinations")
            .category("MRI")
            .modality("MR")
            .bodyPart("BRAIN")
            .isActive(true)
            .isDefault(true)
            .sortOrder(3)
            .defaultTechnique("MRI of the brain was performed without and with gadolinium contrast. Standard sequences including T1, T2, FLAIR, DWI, and post-contrast T1 were obtained.")
            .defaultFindings("""
                BRAIN PARENCHYMA: No acute infarct on DWI. No intracranial hemorrhage. Normal gray-white matter differentiation.
                
                WHITE MATTER: No abnormal white matter signal.
                
                VENTRICLES: Normal size and configuration.
                
                EXTRA-AXIAL SPACES: No extra-axial collection.
                
                ENHANCEMENT: No abnormal parenchymal or meningeal enhancement.
                
                MIDLINE STRUCTURES: Normal.
                
                POSTERIOR FOSSA: Normal cerebellum and brainstem.
                
                ORBITS: Normal.
                
                PARANASAL SINUSES: Clear.""")
            .defaultImpression("Normal MRI of the brain.")
            .build());

        // X-Ray Chest Template
        templateRepository.save(ReportTemplate.builder()
            .templateId("XR-CHEST-001")
            .name("Chest X-Ray (PA/Lateral)")
            .description("Standard template for Chest X-Ray")
            .category("X-Ray")
            .modality("CR")
            .bodyPart("CHEST")
            .isActive(true)
            .isDefault(true)
            .sortOrder(4)
            .defaultTechnique("PA and lateral views of the chest were obtained.")
            .defaultFindings("""
                LUNGS: The lungs are clear bilaterally. No focal consolidation, pleural effusion, or pneumothorax.
                
                HEART: Cardiac silhouette is normal in size.
                
                MEDIASTINUM: Mediastinal contours are normal.
                
                BONES: No acute osseous abnormality.""")
            .defaultImpression("No acute cardiopulmonary abnormality.")
            .build());

        // Ultrasound Abdomen Template
        templateRepository.save(ReportTemplate.builder()
            .templateId("US-ABD-001")
            .name("Ultrasound Abdomen Complete")
            .description("Standard template for complete abdominal ultrasound")
            .category("Ultrasound")
            .modality("US")
            .bodyPart("ABDOMEN")
            .isActive(true)
            .isDefault(true)
            .sortOrder(5)
            .defaultTechnique("Complete abdominal ultrasound was performed.")
            .defaultFindings("""
                LIVER: Normal size and echogenicity. No focal lesion.
                
                GALLBLADDER: Normal. No stones or wall thickening.
                
                BILE DUCTS: Not dilated. CBD measures X mm.
                
                PANCREAS: Visualized portions are normal.
                
                SPLEEN: Normal size at X cm.
                
                RIGHT KIDNEY: Normal size at X cm. No hydronephrosis or stone.
                
                LEFT KIDNEY: Normal size at X cm. No hydronephrosis or stone.
                
                AORTA: Normal caliber.""")
            .defaultImpression("Normal abdominal ultrasound.")
            .build());

        // Mammography Template
        templateRepository.save(ReportTemplate.builder()
            .templateId("MG-001")
            .name("Screening Mammogram")
            .description("Template for screening mammography")
            .category("Mammography")
            .modality("MG")
            .bodyPart("BREAST")
            .isActive(true)
            .isDefault(true)
            .sortOrder(6)
            .defaultTechnique("Bilateral digital screening mammogram with CC and MLO views.")
            .defaultFindings("""
                BREAST COMPOSITION: The breasts are [heterogeneously dense/scattered fibroglandular densities/almost entirely fatty/extremely dense].
                
                RIGHT BREAST: No suspicious mass, calcification, or architectural distortion.
                
                LEFT BREAST: No suspicious mass, calcification, or architectural distortion.
                
                AXILLAE: No suspicious lymph nodes.""")
            .defaultImpression("BI-RADS Category 1: Negative.\nRoutine screening mammography recommended in 1 year.")
            .build());
    }
}

