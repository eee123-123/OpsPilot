package com.opspilot.api.web;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Locale;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class ProblemResponseWriter {

    @SuppressFBWarnings(value = "EI_EXPOSE_REP2", justification = "Spring manages the injected mapper bean")
    private final ObjectMapper objectMapper;

    public ProblemResponseWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(
            HttpServletRequest request,
            HttpServletResponse response,
            int status,
            String title,
            String detail,
            String errorCode) throws IOException {
        String requestId = RequestIdFilter.currentRequestId(request);
        response.setStatus(status);
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setHeader(RequestIdFilter.HEADER_NAME, requestId);
        Map<String, Object> problem = new LinkedHashMap<>();
        problem.put(
                "type",
                URI.create("https://ops-pilot.local/problems/" + errorCode.toLowerCase(Locale.ROOT)));
        problem.put("title", title);
        problem.put("status", status);
        problem.put("detail", detail);
        problem.put("instance", request.getRequestURI());
        problem.put("errorCode", errorCode);
        problem.put("requestId", requestId);
        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}
