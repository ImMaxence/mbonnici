package fr.mbonnici.portfolio.storage;

import java.util.List;
import java.util.Optional;

/** Minimal object-store abstraction so the rest of the app never touches a vendor SDK. */
public interface StorageService {

    record StoredObject(byte[] bytes, String contentType, long length) {}

    record StoredKey(String key, long size) {}

    void put(String key, String contentType, byte[] bytes);

    Optional<StoredObject> get(String key);

    void delete(String key);

    /** Every object in the bucket (used by backups). */
    List<StoredKey> list();

    /** Short human-readable status for the back office ("ok", or an error message). */
    String health();

    String describe();
}
