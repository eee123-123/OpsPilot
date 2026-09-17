package com.opspilot.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:ops-pilot",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.flyway.enabled=false"
})
class OpsPilotApiApplicationTest {

    @Autowired
    private ApplicationContext applicationContext;

    @Test
    void loadsApplicationContext() {
        assertThat(applicationContext).isNotNull();
    }
}
