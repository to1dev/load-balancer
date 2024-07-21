DROP TABLE IF EXISTS realms;

CREATE TABLE IF NOT EXISTS realms (
    RealmName TEXT PRIMARY KEY NOT NULL,
    RealmId TEXT NOT NULL UNIQUE,
    RealmNumber INTEGER NOT NULL UNIQUE,
    RealmMinter TEXT NOT NULL,
    RealmOwner TEXT NOT NULL,
    RealmAvatar TEXT,
    RealmBanner TEXT,
    RealmMeta TEXT,
    RealmProfile TEXT
);
