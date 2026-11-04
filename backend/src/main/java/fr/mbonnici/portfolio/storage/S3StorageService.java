package fr.mbonnici.portfolio.storage;

import fr.mbonnici.portfolio.config.AppProperties;
import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/** Images live in a private S3-compatible bucket (MinIO in docker-compose) and are streamed by the API. */
@Service
@Profile("!test")
public class S3StorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(S3StorageService.class);

    private final S3Client s3;
    private final String bucket;
    private final String endpoint;
    private volatile boolean bucketReady;

    public S3StorageService(S3Client s3, AppProperties props) {
        this.s3 = s3;
        this.bucket = props.storage().bucket();
        this.endpoint = props.storage().endpoint();
    }

    @PostConstruct
    void ensureBucket() {
        try {
            ensureBucketNow();
        } catch (Exception e) {
            // Storage may still be starting (compose ordering); retried lazily on first write.
            log.warn("Object storage not reachable at startup ({}): {}", endpoint, e.getMessage());
        }
    }

    private void ensureBucketNow() {
        if (bucketReady) {
            return;
        }
        try {
            s3.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
        } catch (NoSuchBucketException e) {
            log.info("Creating bucket {}", bucket);
            s3.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
        }
        bucketReady = true;
    }

    @Override
    public void put(String key, String contentType, byte[] bytes) {
        ensureBucketNow();
        s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType)
                .cacheControl("public, max-age=31536000, immutable").build(), RequestBody.fromBytes(bytes));
    }

    @Override
    public Optional<StoredObject> get(String key) {
        try {
            ResponseBytes<GetObjectResponse> res = s3.getObjectAsBytes(
                    GetObjectRequest.builder().bucket(bucket).key(key).build());
            byte[] bytes = res.asByteArray();
            return Optional.of(new StoredObject(bytes, res.response().contentType(), bytes.length));
        } catch (NoSuchKeyException | NoSuchBucketException e) {
            return Optional.empty();
        }
    }

    @Override
    public void delete(String key) {
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }

    @Override
    public List<StoredKey> list() {
        List<StoredKey> out = new ArrayList<>();
        try {
            s3.listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(bucket).build())
                    .contents()
                    .forEach(o -> out.add(new StoredKey(o.key(), o.size() == null ? 0 : o.size())));
        } catch (NoSuchBucketException e) {
            return List.of();
        }
        return out;
    }

    @Override
    public String health() {
        try {
            s3.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
            return "ok";
        } catch (Exception e) {
            return "error: " + e.getClass().getSimpleName();
        }
    }

    @Override
    public String describe() {
        return "S3 " + endpoint + " / " + bucket;
    }
}
