-- D1 Migration Schema for Ini Corn Web App

-- Users Table
CREATE TABLE IF NOT EXISTS Users (
  Username TEXT PRIMARY KEY,
  Password TEXT NOT NULL,
  Role TEXT DEFAULT 'User',
  Approved INTEGER DEFAULT 0
);

-- Default Users Seeding
INSERT OR IGNORE INTO Users (Username, Password, Role, Approved) VALUES ('admin', 'admin123', 'admin', 1);
INSERT OR IGNORE INTO Users (Username, Password, Role, Approved) VALUES ('pattarawin', '19962539', 'admin', 1);

-- BatchData Table
CREATE TABLE IF NOT EXISTS BatchData (
  ID TEXT PRIMARY KEY,
  Title TEXT NOT NULL,
  Date TEXT NOT NULL,
  Status TEXT NOT NULL,
  FermentationDays INTEGER NOT NULL,
  FormulaType INTEGER NOT NULL,
  RawData TEXT NOT NULL, -- JSON text
  CreatedAt TEXT NOT NULL,
  UpdatedAt TEXT NOT NULL,
  Username TEXT,
  FOREIGN KEY (Username) REFERENCES Users(Username)
);

-- Scents Table (Dashboard Reference Data)
CREATE TABLE IF NOT EXISTS Scents (
  Name TEXT PRIMARY KEY,
  Taste TEXT NOT NULL,
  Scent TEXT NOT NULL
);

-- Sweetness Table (Dashboard Reference Data)
CREATE TABLE IF NOT EXISTS Sweetness (
  Name TEXT PRIMARY KEY,
  Taste TEXT NOT NULL,
  Scent TEXT NOT NULL
);

-- FruitFermentation Guidelines Table
CREATE TABLE IF NOT EXISTS FruitFermentation (
  Guideline TEXT PRIMARY KEY
);

-- RoastedGrainFermentation Guidelines Table
CREATE TABLE IF NOT EXISTS RoastedGrainFermentation (
  Guideline TEXT PRIMARY KEY
);

-- ChecklistTemplate Table
CREATE TABLE IF NOT EXISTS ChecklistTemplate (
  StepIndex INTEGER PRIMARY KEY,
  Text TEXT NOT NULL,
  Color TEXT NOT NULL
);

-- IngredientStock Table
CREATE TABLE IF NOT EXISTS IngredientStock (
  ID TEXT PRIMARY KEY,
  Name TEXT NOT NULL,
  Category TEXT NOT NULL,
  Quantity REAL NOT NULL DEFAULT 0.0,
  Unit TEXT NOT NULL,
  MinQuantity REAL NOT NULL DEFAULT 0.0,
  Price REAL NOT NULL DEFAULT 0.0,
  Supplier TEXT,
  Note TEXT,
  UpdatedAt TEXT NOT NULL,
  Username TEXT,
  FOREIGN KEY (Username) REFERENCES Users(Username)
);

-- IngredientUnits Table
CREATE TABLE IF NOT EXISTS IngredientUnits (
  UnitName TEXT NOT NULL,
  Username TEXT NOT NULL,
  PRIMARY KEY (UnitName, Username),
  FOREIGN KEY (Username) REFERENCES Users(Username)
);

-- Default Units Seeding
INSERT OR IGNORE INTO IngredientUnits (UnitName, Username) VALUES ('กก.', 'admin');
INSERT OR IGNORE INTO IngredientUnits (UnitName, Username) VALUES ('กรัม', 'admin');
INSERT OR IGNORE INTO IngredientUnits (UnitName, Username) VALUES ('ลิตร', 'admin');
INSERT OR IGNORE INTO IngredientUnits (UnitName, Username) VALUES ('มล.', 'admin');
INSERT OR IGNORE INTO IngredientUnits (UnitName, Username) VALUES ('ถุง', 'admin');
INSERT OR IGNORE INTO IngredientUnits (UnitName, Username) VALUES ('แพ็ค', 'admin');
INSERT OR IGNORE INTO IngredientUnits (UnitName, Username) VALUES ('กล่อง', 'admin');

-- SystemSettings Table
CREATE TABLE IF NOT EXISTS SystemSettings (
  Key TEXT PRIMARY KEY,
  Value TEXT NOT NULL,
  Username TEXT,
  UpdatedAt TEXT NOT NULL
);
