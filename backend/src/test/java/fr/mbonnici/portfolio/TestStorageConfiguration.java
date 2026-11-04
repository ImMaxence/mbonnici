package fr.mbonnici.portfolio;

import fr.mbonnici.portfolio.storage.StorageService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Replaces the S3 client with an in-memory map so tests need no object store. */
@TestConfiguration(proxyBeanMethods = false)
class TestStorageConfiguration {

    static final class InMemoryStorage implements StorageService {
        private final Map<String, StoredObject> objects = new ConcurrentHashMap<>();

        @Override
        public void put(String key, String contentType, byte[] bytes) {
            objects.put(key, new StoredObject(bytes, contentType, bytes.length));
        }

        @Override
        public Optional<StoredObject> get(String key) {
            return Optional.ofNullable(objects.get(key));
        }

        @Override
        public void delete(String key) {
            objects.remove(key);
        }

        @Override
        public List<StoredKey> list() {
            return objects.entrySet().stream().map(e -> new StoredKey(e.getKey(), e.getValue().length())).toList();
        }

        @Override
        public String health() {
            return "ok";
        }

        @Override
        public String describe() {
            return "in-memory";
        }
    }

    @Bean
    @Primary
    StorageService inMemoryStorage() {
        return new InMemoryStorage();
    }
}
