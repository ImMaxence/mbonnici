package fr.mbonnici.portfolio.config;

import java.net.URI;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
@Profile("!test")
public class StorageConfig {

    @Bean
    S3Client s3Client(AppProperties props) {
        AppProperties.Storage s = props.storage();
        return S3Client.builder()
                .endpointOverride(URI.create(s.endpoint()))
                .region(Region.of(s.region()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(s.accessKey(), s.secretKey())))
                .forcePathStyle(s.pathStyle())
                // S3-compatible stores (MinIO, SeaweedFS, R2…) do not all implement the newer
                // default integrity checksums; only compute them when the operation requires it.
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .httpClientBuilder(UrlConnectionHttpClient.builder())
                .build();
    }
}
