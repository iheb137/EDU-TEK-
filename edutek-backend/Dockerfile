# ---------- Etape 1 : compilation ----------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
# Dependances d'abord : mises en cache tant que pom.xml ne change pas
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
# Puis le code, et fabrication du .jar (les tests tournent dans la CI)
COPY src src
RUN mvn -B -q package -DskipTests

# ---------- Etape 2 : execution ----------
FROM eclipse-temurin:17-jre
WORKDIR /app
# Utilisateur sans privileges + dossier des fichiers televerses
RUN useradd --system --uid 10001 edutek \
 && mkdir -p /app/uploads && chown edutek /app/uploads
COPY --from=build /app/target/*.jar app.jar
USER edutek
EXPOSE 8080
# La JVM s'adapte a la memoire allouee au conteneur
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
