CREATE TABLE IF NOT EXISTS recruitment_offices (
 id VARCHAR(36) PRIMARY KEY, owner VARCHAR(191) NOT NULL, name VARCHAR(200) NOT NULL, country VARCHAR(100) NOT NULL DEFAULT '',
 active TINYINT NOT NULL DEFAULT 1, version INT NOT NULL DEFAULT 1,
 created VARCHAR(32) NOT NULL, updated VARCHAR(32) NOT NULL,
 UNIQUE KEY offices_owner_name(owner,name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS office_records (
 record_id VARCHAR(36) PRIMARY KEY, owner VARCHAR(191) NOT NULL, office_id VARCHAR(36) NOT NULL,
 created VARCHAR(32) NOT NULL, KEY office_records_owner(owner,office_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @office_country_upgrade = (SELECT IF(COUNT(*)=0, 'ALTER TABLE recruitment_offices ADD COLUMN country VARCHAR(100) NOT NULL DEFAULT \'\'', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='recruitment_offices' AND COLUMN_NAME='country');
PREPARE office_country_stmt FROM @office_country_upgrade;
EXECUTE office_country_stmt;
DEALLOCATE PREPARE office_country_stmt;
