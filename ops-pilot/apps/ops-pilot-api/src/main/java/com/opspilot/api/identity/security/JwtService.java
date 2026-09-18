package com.opspilot.api.identity.security;

import com.opspilot.api.identity.config.IdentityProperties;
import com.opspilot.api.identity.domain.UserAccount;
import java.time.Clock;
import java.time.Instant;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final JwtEncoder jwtEncoder;
    private final JwtDecoder jwtDecoder;
    private final IdentityProperties properties;
    private final Clock clock;

    public JwtService(
            JwtEncoder jwtEncoder, JwtDecoder jwtDecoder, IdentityProperties properties, Clock clock) {
        this.jwtEncoder = jwtEncoder;
        this.jwtDecoder = jwtDecoder;
        this.properties = properties;
        this.clock = clock;
    }

    public IssuedToken issue(UserAccount user) {
        Instant issuedAt = Instant.now(clock);
        Instant expiresAt = issuedAt.plus(properties.accessTokenTtl());
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(properties.jwtIssuer())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .subject(user.id().toString())
                .claim("username", user.username())
                .claim("ver", user.tokenVersion())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedToken(token, expiresAt);
    }

    public Jwt decode(String token) {
        return jwtDecoder.decode(token);
    }

    public record IssuedToken(String value, Instant expiresAt) {
    }
}
