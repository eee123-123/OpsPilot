package com.opspilot.api.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.opspilot.api.OpsPilotApiApplication;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import org.junit.jupiter.api.Test;

class ModuleBoundaryTest {

    @Test
    void apiDoesNotDependOnOtherDeployableApplications() {
        JavaClasses apiClasses = new ClassFileImporter().importPackagesOf(OpsPilotApiApplication.class);

        noClasses()
                .that().resideInAPackage("com.opspilot.api..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "com.opspilot.mcp..",
                        "com.opspilot.demo..")
                .check(apiClasses);
    }
}
