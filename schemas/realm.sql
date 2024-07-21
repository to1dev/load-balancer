DROP TABLE IF EXISTS realms;

CREATE TABLE IF NOT EXISTS realms (
    RealmName TEXT PRIMARY KEY NOT NULL,
    RealmId TEXT NOT NULL UNIQUE,
    RealmNumber INTEGER NOT NULL UNIQUE,
    RealmMinter TEXT NOT NULL,
    RealmOwner TEXT NOT NULL,
    RealmAvatar TEXT,
    RealmBanner TEXT,
    Meta TEXT NOT NULL
);

INSERT INTO
    realms (RealmName, RealmId, RealmNumber)
VALUES
    (
        'to1dev',
        '8888ada7af2b7e73d69c520b33991a3a0c3ce0a6917e932cd2f8700ebd337213i0',
        189174
    ),
    (
        'happilynorth',
        '1576801e233ea2d09e77249aa542b1e083403603bfa41991d1e39da5b81f6291i0',
        215894
    ),
    (
        'datediver',
        '77776b32e863ac6b055abc5fe844a0f32b7ca1446655c09b97accd46bce7d022i0',
        192694
    ),
    (
        'diss',
        '8193bfdaccf4d5e0fa3957f53c29008a51021a58f9dfd1fb824f3ddd5d7c3953i0',
        188922
    ),
    (
        'godzilla',
        '88883082fd32ae93db927832eaff62539d6a7b28868985ad1f469b12182e4620i0',
        187784
    );
