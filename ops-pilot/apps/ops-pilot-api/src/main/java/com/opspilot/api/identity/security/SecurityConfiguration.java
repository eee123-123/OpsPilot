package com.opspilot.api.identity.security;

import com.opspilot.api.identity.audit.AuditService;
import com.opspilot.api.identity.config.IdentityProperties;
import com.opspilot.api.web.ProblemResponseWriter;
import com.opspilot.api.web.RequestIdFilter;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;

@Configuration
@EnableMethodSecurity
public class SecurityConfiguration {

    @Bean
    @SuppressFBWarnings(
            value = "THROWS_METHOD_THROWS_CLAUSE_BASIC_EXCEPTION",
            justification = "HttpSecurity build and configurer APIs declare Exception")
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            PasswordChangeRequiredFilter passwordChangeRequiredFilter,
            ProblemResponseWriter problemWriter,
            AuditService auditService) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
                        .requestMatchers("/actuator/health/**", "/actuator/info", "/actuator/prometheus").permitAll()
                        .requestMatchers("/api/v1/users/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, exception) -> {
                            String requestId = RequestIdFilter.currentRequestId(request);
                            auditService.recordAuthenticationFailure("anonymous", requestId, "AUTHENTICATION_REQUIRED");
                            problemWriter.write(
                                    request, response, 401, "Unauthorized",
                                    "Authentication is required", "AUTHENTICATION_REQUIRED");
                        })
                        .accessDeniedHandler((request, response, exception) -> {
                            UserPrincipal principal = principalOrNull();
                            String requestId = RequestIdFilter.currentRequestId(request);
                            auditService.record(
                                    "AUTHORIZATION_FAILURE", "DENIED",
                                    principal == null ? null : principal.id(),
                                    principal == null ? "anonymous" : principal.username(),
                                    "API", request.getRequestURI(), requestId, "ACCESS_DENIED", null, null);
                            problemWriter.write(
                                    request, response, 403, "Forbidden",
                                    "You do not have permission to perform this operation", "ACCESS_DENIED");
                        }))
                .addFilterBefore(jwtAuthenticationFilter, AnonymousAuthenticationFilter.class)
                .addFilterAfter(passwordChangeRequiredFilter, JwtAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    JwtEncoder jwtEncoder(IdentityProperties properties) {
        return NimbusJwtEncoder.withSecretKey(secretKey(properties))
                .algorithm(MacAlgorithm.HS256)
                .build();
    }

    @Bean
    JwtDecoder jwtDecoder(IdentityProperties properties) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey(properties))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(properties.jwtIssuer()));
        return decoder;
    }

    private static SecretKey secretKey(IdentityProperties properties) {
        return new SecretKeySpec(properties.jwtSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    private static UserPrincipal principalOrNull() {
        var authentication = org.springframework.security.core.context.SecurityContextHolder
                .getContext().getAuthentication();
        Object principal = authentication == null ? null : authentication.getPrincipal();
        return principal instanceof UserPrincipal userPrincipal ? userPrincipal : null;
    }
}
