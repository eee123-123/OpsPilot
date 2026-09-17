FROM maven:3.9.16-eclipse-temurin-21 AS build

ARG MODULE
WORKDIR /workspace
COPY . .
RUN --mount=type=cache,target=/root/.m2,sharing=locked \
    mvn -B -ntp -pl "${MODULE}" -am package -DskipTests \
    && find "${MODULE}/target" -maxdepth 1 -type f -name '*.jar' ! -name '*.original' \
       -exec cp '{}' /workspace/application.jar \;

FROM eclipse-temurin:21-jre-jammy

WORKDIR /application
COPY --from=build /workspace/application.jar application.jar
USER 10001
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/application/application.jar"]
