function doGet(e) {
  var template = HtmlService.createTemplateFromFile('index');
  var output = template.evaluate()
      .setTitle('Ini Corn')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  
  output.setFaviconUrl("https://files.catbox.moe/pn0hx6.png");
  return output;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Robust database initialization and connection.
 * Finds the bound spreadsheet or searches/creates a fallback "Web App ทำสุรา" on Drive.
 */
function getSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  
  var ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {}
  }
  
  try {
    var files = DriveApp.getFilesByName("Web App ทำสุรา");
    if (files.hasNext()) {
      var file = files.next();
      var ss = SpreadsheetApp.open(file);
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
      return ss;
    }
  } catch (e) {}
  
  try {
    var ss = SpreadsheetApp.create("Web App ทำสุรา");
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
    return ss;
  } catch (e) {}
  
  throw new Error("Unable to locate or create a spreadsheet for data storage.");
}

function getOrCreateSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  var standardHeaders = ['ID', 'Title', 'Date', 'Status', 'FermentationDays', 'FormulaType', 'RawData', 'CreatedAt', 'UpdatedAt', 'Username'];
  
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === 'BatchData') {
      sheet.appendRow(standardHeaders);
    }
  } else if (name === 'BatchData') {
    var data = sheet.getDataRange().getValues();
    var hasHeaders = false;
    if (data && data.length > 0 && data[0].length > 0) {
      var firstRow = data[0].map(function(h) { return h ? h.toString().trim() : ''; });
      if (firstRow.indexOf('ID') >= 0 && firstRow.indexOf('Status') >= 0) {
        hasHeaders = true;
      }
    }
    if (!hasHeaders) {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(standardHeaders);
      } else {
        sheet.getRange(1, 1, 1, standardHeaders.length).setValues([standardHeaders]);
      }
    }
  }
  return sheet;
}

function getOrCreateSheetClean(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Fetch saved batches for a specific user with serialization fix
 */
function getBatches(username) {
  try {
    var sheet = getOrCreateSheet('BatchData');
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    var headers = data[0];
    
    // Check if Username is in headers, if not append it dynamically
    var usernameIndex = headers.indexOf('Username');
    if (usernameIndex < 0) {
      headers.push('Username');
      sheet.getRange(1, headers.length).setValue('Username');
      usernameIndex = headers.length - 1;
    }
    
    var idIndex = headers.indexOf('ID');
    if (idIndex < 0) {
      return { error: 'ไม่พบหัวตารางคอลัมน์ ID ในชีต BatchData' };
    }
    
    var filterUser = username ? username.trim().toLowerCase() : '';
    
    var list = [];
    for (var i = 1; i < data.length; i++) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var val = data[i][j];
        if (val instanceof Date) {
          if (!isNaN(val.getTime())) {
            obj[headers[j]] = val.toISOString();
          } else {
            obj[headers[j]] = '';
          }
        } else {
          obj[headers[j]] = val;
        }
      }
      
      if (obj['ID']) {
        var rowUser = obj['Username'] ? obj['Username'].toString().trim().toLowerCase() : '';
        
        // Migration: If Username is empty and the logged in user is pattarawin,
        // automatically assign the row to pattarawin so old data is retained.
        if (rowUser === '' && filterUser === 'pattarawin') {
          sheet.getRange(i + 1, usernameIndex + 1).setValue('pattarawin');
          obj['Username'] = 'pattarawin';
          rowUser = 'pattarawin';
        }
        
        // Filter by username if specified
        if (username) {
          if (rowUser !== filterUser) {
            continue; // Skip another user's data
          }
        }
        list.push(obj);
      }
    }
    return list;
  } catch (e) {
    Logger.log("Error in getBatches: " + e.toString());
    return { error: 'เกิดข้อผิดพลาดในการโหลดชีต: ' + e.toString() };
  }
}

/**
 * Save new or update existing batch
 */
function saveBatch(batchObj) {
  try {
    var sheet = getOrCreateSheet('BatchData');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    // Check if Username is in headers, if not append it dynamically
    var usernameIndex = headers.indexOf('Username');
    if (usernameIndex < 0) {
      headers.push('Username');
      sheet.getRange(1, headers.length).setValue('Username');
      usernameIndex = headers.length - 1;
    }
    
    var idIndex = headers.indexOf('ID');
    if (idIndex < 0) {
      var standardHeaders = ['ID', 'Title', 'Date', 'Status', 'FermentationDays', 'FormulaType', 'RawData', 'CreatedAt', 'UpdatedAt', 'Username'];
      sheet.getRange(1, 1, 1, standardHeaders.length).setValues([standardHeaders]);
      data = sheet.getDataRange().getValues();
      headers = data[0];
      idIndex = headers.indexOf('ID');
      usernameIndex = headers.indexOf('Username');
    }
    
    var now = new Date().toISOString();
    if (!batchObj.ID) {
      batchObj.ID = 'B_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
      batchObj.CreatedAt = now;
    }
    batchObj.UpdatedAt = now;
    
    // Find row by ID
    var rowIndex = -1;
    var createdAtIndex = headers.indexOf('CreatedAt');
    for (var i = 1; i < data.length; i++) {
      if (data[i][idIndex] && batchObj.ID && data[i][idIndex].toString().trim() === batchObj.ID.toString().trim()) {
        rowIndex = i + 1;
        // Retain the original CreatedAt timestamp when updating
        if (createdAtIndex >= 0 && data[i][createdAtIndex]) {
          batchObj.CreatedAt = data[i][createdAtIndex] instanceof Date ? data[i][createdAtIndex].toISOString() : data[i][createdAtIndex];
        }
        // Verify owner permission if username exists on row
        if (usernameIndex >= 0 && data[i][usernameIndex]) {
          var rowOwner = data[i][usernameIndex].toString().trim().toLowerCase();
          var currentOwner = batchObj.Username ? batchObj.Username.toString().trim().toLowerCase() : '';
          var isAdmin = currentOwner === 'admin' || currentOwner === 'pattarawin';
          if (rowOwner && rowOwner !== currentOwner && !isAdmin) {
            throw new Error("ไม่มีสิทธิ์ในการบันทึกทับข้อมูลของผู้อื่น");
          }
        }
        break;
      }
    }
    
    // Convert object to row values matching headers
    var newRow = headers.map(function(header) {
      if (header === 'RawData') {
        return JSON.stringify(batchObj.RawData || batchObj);
      }
      return batchObj[header] !== undefined ? batchObj[header] : '';
    });
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }
    return batchObj;
  } catch (e) {
    Logger.log("Error in saveBatch: " + e.toString());
    throw new Error("บันทึกข้อมูลไม่สำเร็จ: " + e.toString());
  }
}

/**
 * Quick update batch status or fermentation days from the list view
 */
function updateBatchStatus(id, newStatus, fermentationDays, testResult, username, expectedSales, distillVolReal) {
  try {
    var sheet = getOrCreateSheet('BatchData');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idIndex = headers.indexOf('ID');
    var dateIndex = headers.indexOf('Date');
    var statusIndex = headers.indexOf('Status');
    var daysIndex = headers.indexOf('FermentationDays');
    var rawIndex = headers.indexOf('RawData');
    var updatedIndex = headers.indexOf('UpdatedAt');
    var usernameIndex = headers.indexOf('Username');
    
    if (idIndex < 0 || statusIndex < 0) {
      return false;
    }
    
    var rowIndex = -1;
    var startDateVal = null;
    for (var i = 1; i < data.length; i++) {
      if (data[i][idIndex] === id) {
        rowIndex = i + 1;
        startDateVal = (dateIndex >= 0) ? data[i][dateIndex] : null;
        
        // Verify owner permission if username exists on row
        if (usernameIndex >= 0 && data[i][usernameIndex] && username) {
          var rowOwner = data[i][usernameIndex].toString().trim().toLowerCase();
          var currentUser = username.trim().toLowerCase();
          if (rowOwner && rowOwner !== currentUser) {
            return false; // Forbidden
          }
        }
        break;
      }
    }
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, statusIndex + 1).setValue(newStatus);
      if (fermentationDays !== undefined && fermentationDays !== null && daysIndex >= 0) {
        sheet.getRange(rowIndex, daysIndex + 1).setValue(fermentationDays);
      }
      if (updatedIndex >= 0) {
        sheet.getRange(rowIndex, updatedIndex + 1).setValue(new Date().toISOString());
      }
      
      // Update RawData JSON string too
      if (rawIndex >= 0) {
        var rawCell = sheet.getRange(rowIndex, rawIndex + 1);
        var rawVal = rawCell.getValue();
        if (rawVal) {
          try {
            var rawObj = JSON.parse(rawVal);
            rawObj.Status = newStatus;
            if (fermentationDays !== undefined && fermentationDays !== null) {
              rawObj.FermentationDays = fermentationDays;
              
              // Recalculate dateFermentEnd in RawData JSON
              if (startDateVal) {
                var startDate = null;
                if (typeof startDateVal === 'string' && startDateVal.indexOf('-') >= 0) {
                  var parts = startDateVal.split('-');
                  if (parts.length === 3) {
                    var year = parseInt(parts[0], 10);
                    var month = parseInt(parts[1], 10) - 1;
                    var day = parseInt(parts[2], 10);
                    startDate = new Date(year, month, day);
                  }
                }
                if (!startDate || isNaN(startDate.getTime())) {
                  startDate = new Date(startDateVal);
                }
                if (startDate && !isNaN(startDate.getTime())) {
                  startDate.setDate(startDate.getDate() + fermentationDays);
                  var outYear = startDate.getFullYear();
                  var outMonth = String(startDate.getMonth() + 1).padStart(2, '0');
                  var outDay = String(startDate.getDate()).padStart(2, '0');
                  rawObj.dateFermentEnd = outYear + '-' + outMonth + '-' + outDay;
                }
              }
            }
            if (testResult !== undefined && testResult !== null) {
              rawObj.testResult = testResult;
            }
            if (expectedSales !== undefined && expectedSales !== null && expectedSales !== '') {
              rawObj.expectedSales = parseFloat(expectedSales) || 0;
            }
            if (distillVolReal !== undefined && distillVolReal !== null && distillVolReal !== '') {
              rawObj.distillVolReal = parseFloat(distillVolReal) || 0;
            }
            rawObj.UpdatedAt = new Date().toISOString();
            rawCell.setValue(JSON.stringify(rawObj));
          } catch (e) {}
        }
      }
      return true;
    }
    return false;
  } catch (e) {
    Logger.log("Error in updateBatchStatus: " + e.toString());
    return false;
  }
}

/**
 * Save Tank Tag measurements (sweetness before, sweetness after, spirits volume)
 */
function saveTankTagMeasurements(id, brixBefore, brixAfter, distillVol, username) {
  try {
    var sheet = getOrCreateSheet('BatchData');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idIndex = headers.indexOf('ID');
    var rawIndex = headers.indexOf('RawData');
    var updatedIndex = headers.indexOf('UpdatedAt');
    if (idIndex < 0 || rawIndex < 0) return false;
    for (var i = 1; i < data.length; i++) {
      if (data[i][idIndex] === id) {
        var rowIndex = i + 1;
        var rawCell = sheet.getRange(rowIndex, rawIndex + 1);
        var rawVal = rawCell.getValue();
        var rawObj = {};
        try {
          rawObj = typeof rawVal === 'string' ? JSON.parse(rawVal) : (rawVal || {});
        } catch(e) {
          rawObj = {};
        }
        if (brixBefore !== undefined) rawObj.tagBrixBefore = brixBefore;
        if (brixAfter !== undefined) rawObj.tagBrixAfter = brixAfter;
        if (distillVol !== undefined) {
          rawObj.tagDistillVol = distillVol;
          var num = parseFloat(distillVol);
          if (!isNaN(num)) rawObj.distillVolReal = num;
        }
        rawObj.UpdatedAt = new Date().toISOString();
        rawCell.setValue(JSON.stringify(rawObj));
        if (updatedIndex >= 0) sheet.getRange(rowIndex, updatedIndex + 1).setValue(new Date().toISOString());
        return true;
      }
    }
    return false;
  } catch(e) {
    Logger.log("Error in saveTankTagMeasurements: " + e.toString());
    return false;
  }
}

/**
 * Delete a batch
 */
function deleteBatch(id, username) {
  try {
    var sheet = getOrCreateSheet('BatchData');
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idIndex = headers.indexOf('ID');
    var usernameIndex = headers.indexOf('Username');
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][idIndex] === id) {
        // Verify owner permission if username exists on row
        if (usernameIndex >= 0 && data[i][usernameIndex] && username) {
          var rowOwner = data[i][usernameIndex].toString().trim().toLowerCase();
          var currentUser = username.trim().toLowerCase();
          if (rowOwner && rowOwner !== currentUser) {
            return false; // Forbidden
          }
        }
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  } catch (e) {
    Logger.log("Error in deleteBatch: " + e.toString());
    return false;
  }
}

/**
 * Fetch static reference data from sheets or fallbacks
 */
function getDashboardData() {
  var ss = getSpreadsheet();
  var data = {
    scents: [],
    sweetness: [],
    fruitFermentation: [],
    roastedGrainFermentation: []
  };

  // Try reading "ตารางกลิ่นและรสชาติของวัตถุดิบ" from sheet
  try {
    var sheet = ss.getSheetByName("ตารางกลิ่นและรสชาติของวัตถุดิบ");
    if (sheet) {
      var vals = sheet.getDataRange().getValues();
      for (var i = 2; i < vals.length; i++) {
        if (vals[i][0]) {
          data.scents.push({ name: vals[i][0].toString(), taste: vals[i][1].toString(), scent: vals[i][2].toString() });
        }
      }
    }
  } catch(e) {}
  
  if (data.scents.length === 0) {
    data.scents = [
      { name: "ข้าวเหนียว", taste: "- นุ่มละมุน\n- หวานธรรมชาติ\n- ดื่มง่าย", scent: "- กลิ่นข้าวสุกอ่อน" },
      { name: "ข้าวเจ้า", taste: "- สะอาด\n- บอดี้บางกว่าข้าวเหนียว", scent: "- กลิ่นข้าวสุกหอมอ่อนๆ" },
      { name: "ข้าวโพด", taste: "- หวาน", scent: "- กลิ่นเนยอ่อน\n- กลิ่นข้าวโพดติดปลายแอลกอฮอล์" },
      { name: "ข้าวบาร์เลย์", taste: "- มัน คล้ายถั่ว\n- ขมนิดๆ ตอนปลาย", scent: "- กลิ่นธัญพืชคั่ว\n- กลิ่นมอลต์โดยเฉพาะบาร์เลย์งอกจะให้กลิ่นมอลต์ชัดมาก" },
      { name: "ข้าวสาลี", taste: "- นุ่ม\n- ครีมมี่กลิ่นแอลกอฮอล์ต่ำ", scent: "- กลิ่นแป้งขนมปังอบอ่อนๆ" },
      { name: "ข้าวฟ่างแดง", taste: "- มัน แบบเปลือกถั่วผสมความเปรี้ยวคล้ายผลไม้", scent: "- กลิ่นสับปะรด\n- กลิ่นหมักคล้ายเต้าเจี้ยวหมัก" },
      { name: "ข้าวหอมมะลิ", taste: "- รสชาติที่นุ่มนวลและไม่ทำให้เกิดอาการแฮ้งค์", scent: "- หอมข้าวหอมมะลิ ละมุนกว่าข้าวชนิดอื่น" },
      { name: "มันสำปะหลัง", taste: "- สะอาด เป็นกลาง", scent: "- กลิ่นดินและแป้งอ่อน" }
    ];
  }

  // Try reading "ความหวาน" from sheet
  try {
    var sheet = ss.getSheetByName("ความหวาน");
    if (sheet) {
      var vals = sheet.getDataRange().getValues();
      for (var i = 2; i < vals.length; i++) {
        if (vals[i][0]) {
          data.sweetness.push({ name: vals[i][0].toString(), taste: vals[i][1].toString(), scent: vals[i][2].toString() });
        }
      }
    }
  } catch(e) {}

  if (data.sweetness.length === 0) {
    data.sweetness = [
      { name: "น้ำอ้อย", taste: "- หวานสด สดชื่น", scent: "- กลิ่นหญ้าอ้อย" },
      { name: "กากน้ำตาล", taste: "- หวานเข้ม\n- หนัก\n- ขมหวานแบบน้ำตาลดำ", scent: "- คาราเมล\n- ทอฟฟี่\n- สโมกกี้" },
      { name: "คาราเมลไซรัป", taste: "- หวานเข้ม\n- มีรสไหม้เล็กน้อย", scent: "" },
      { name: "น้ำตาลทรายขาว", taste: "- หวานสะอาดเรียบง่าย", scent: "" },
      { name: "น้ำตาลทรายไม่ฟอก", taste: "- หวานลึก\n- คาราเมล\n- กาแฟ\n- ชะเอม", scent: "- น้ำตาลดำ\n- คาราเมล\n- สโมกกี้" },
      { name: "น้ำผึ้ง", taste: "- หวานธรรมชาติ แตกต่างตามชนิดดอกไม้", scent: "- ดอกไม้\n- ผลไม้\n- ขี้ผึ้ง" }
    ];
  }

  // Try reading "หมักผลไม้ทำแอลกอฮอล์"
  try {
    var sheet = ss.getSheetByName("หมักผลไม้ทำแอลกอฮอล์");
    if (sheet) {
      var vals = sheet.getDataRange().getValues();
      for (var i = 1; i < vals.length; i++) {
        if (vals[i][0]) {
          data.fruitFermentation.push(vals[i][0].toString());
        }
      }
    }
  } catch(e) {}

  if (data.fruitFermentation.length === 0) {
    data.fruitFermentation = [
      "ผลไม้จับคู่เพื่อเน้นรสชาติและกลิ่นเฉพาะ นุ่ม หวานอ่อน",
      "วัตถุดิบ ข้าวเหนียว ข้าวสาลี",
      "หมักที่อุณหภูมิต่ำ 18 - 22°C",
      "ยีสต์หมัก เอสเทอร์ต่ำ"
    ];
  }

  // Try reading "หมักธัญพืชคั่วทำแอลกอฮอล์"
  try {
    var sheet = ss.getSheetByName("หมักธัญพืชคั่วทำแอลกอฮอล์");
    if (sheet) {
      var vals = sheet.getDataRange().getValues();
      for (var i = 1; i < vals.length; i++) {
        if (vals[i][0]) {
          data.roastedGrainFermentation.push(vals[i][0].toString());
        }
      }
    }
  } catch(e) {}

  if (data.roastedGrainFermentation.length === 0) {
    data.roastedGrainFermentation = [
      "บอดี้หนัก กลิ่นลึก",
      "วัตถุดิบ ข้าวบาร์เลย์ ข้าวเจ้า ข้าวโพด",
      "หมักที่อุณหภูมิต่ำ 24 - 30°C",
      "ยีสต์หมัก เอสเทอร์สูง"
    ];
  }

  return data;
}

/**
 * Save updated Dashboard reference tables to Google Sheets
 */
function saveDashboardData(data) {
  try {
    var ss = getSpreadsheet();
    
    // 1. Scents & Tastes
    var sheetScents = getOrCreateSheetClean(ss, "ตารางกลิ่นและรสชาติของวัตถุดิบ");
    sheetScents.appendRow(["ตารางกลิ่นและรสชาติของวัตถุดิบ"]);
    sheetScents.appendRow(["วัตถุดิบ", "รสชาติ", "กลิ่น"]);
    data.scents.forEach(function(item) {
      sheetScents.appendRow([item.name, item.taste, item.scent]);
    });

    // 2. Sweetness
    var sheetSweet = getOrCreateSheetClean(ss, "ความหวาน");
    sheetSweet.appendRow(["ความหวาน"]);
    sheetSweet.appendRow(["วัตถุดิบ", "รสชาติ", "กลิ่น"]);
    data.sweetness.forEach(function(item) {
      sheetSweet.appendRow([item.name, item.taste, item.scent]);
    });

    // 3. Fruit guidelines
    var sheetFruit = getOrCreateSheetClean(ss, "หมักผลไม้ทำแอลกอฮอล์");
    sheetFruit.appendRow(["หมักผลไม้ทำแอลกอฮอล์"]);
    data.fruitFermentation.forEach(function(item) {
      sheetFruit.appendRow([item]);
    });

    // 4. Grain guidelines
    var sheetGrain = getOrCreateSheetClean(ss, "หมักธัญพืชคั่วทำแอลกอฮอล์");
    sheetGrain.appendRow(["หมักธัญพืชคั่วทำแอลกอฮอล์"]);
    data.roastedGrainFermentation.forEach(function(item) {
      sheetGrain.appendRow([item]);
    });
    
    return true;
  } catch (e) {
    Logger.log("Error in saveDashboardData: " + e.toString());
    throw new Error("บันทึกข้อมูลหน้า Dashboard ล้มเหลว: " + e.toString());
  }
}

/**
 * Returns checklist steps from spreadsheet or fallbacks
 */
function getChecklistTemplate() {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName("ขั้นตอนการทำหมักแอลกอฮอล์");
    if (sheet) {
      var vals = sheet.getDataRange().getValues();
      var list = [];
      for (var i = 2; i < vals.length; i++) {
        if (vals[i][1]) {
          var color = vals[i][3] ? vals[i][3].toString() : "blue";
          list.push({ text: vals[i][1].toString(), color: color });
        }
      }
      if (list.length > 0) return list;
    }
  } catch (e) {}

  var defaultSteps = [
    "ถ้าเป็นผลไม้หรือน้ำอ้อยควร ต้ม ก่อนนำไปหมักเสมอ",
    "เตรียมถังหมัก",
    "ใส่ โซเดียมเมตาไบซัลไฟต์ ในถังหมัก",
    "ใส่ น้ำ ตามปริมาณน้ำที่กำหนด",
    "ใส่ น้ำตาล ตามปริมาณที่กำหนด",
    "คนให้ละลายจนหมด",
    "ตรวจสอบอุณหภูมิน้ำ ปกติ 22-25°C ร้อนเกินไป 25-28°C",
    "ใส่ ข้าวสุกใหม่ หรือ ธัญพืชอื่น ล้างข้าวหรือธัญพืชก่อนนึ่งทุกครั้ง",
    "ตรวจสอบอุณหภูมิน้ำ หลังใส่ข้าวสุก อุณหภูมิน้ำจะเพิ่มขึ้นชั่วคราวประมาณ 3-4°C อุณหภูมิไม่ควรเกิน 32°C",
    "ใส่ ลูกแป้ง ตามปริมาณที่กำหนด",
    "ใส่ ยีสต์ ตามปริมาณที่กำหนด",
    "ใส่ เอนไซม์ ตามปริมาณที่กำหนด",
    "คนให้เข้ากัน",
    "เช็คความหวานของน้ำก่อนหมัก",
    "วันที่ 1 ใช้ผ้าปิดคลุมฝาไว้ ไม่ควรปิดสนิท",
    "วันที่ 2 ใช้ถุงปิดฝาให้สนิท",
    "หมักจนครบ 15 - 20 วัน",
    "เช็คความหวานของน้ำหมัก",
    "หากต้องการรสชาติและกลิ่นที่ กลมกล่อมหอม ให้กรองกากออกให้เหลือแค่น้ำไว้อีก 1-5 วัน",
    "ทำการกลั่น",
    "ใช้ไฟกลาง 20-30 นาที",
    "เร่งไฟแรง อุณหภูมิอยู่ที่ 70-90°C",
    "น้ำแอลกอฮอล์ แรกให้เอาออก น้ำหมัก 100 ลิตร ให้เอาน้ำแอลกอฮอล์แรกออก 100cc",
    "พอแอลกอฮอล์ถึง 50 ดีกรีแล้วเบาไฟลงใช้ไฟกลาง",
    "พอแอลกอฮอล์ถึง 40-30 ดีกรีแล้วปิดไฟ",
    "เสร็จการกลั่น",
    "ปรับ ค่าดีกรีแอลกอฮอล์ เติมน้ำเพื่อปรับค่าแอลกอฮอล์",
    "พักให้แอลกอฮอล์เย็นตัวลง 1-3 วันหรือให้เป็นอุณหภูมิห้อง",
    "ทำการกรองแอลกอฮอล์ 1 - 2 รอบ",
    "พักแอลกอฮอล์ ไว้ 3 - 5 วันแล้วค่อยนำมาขาย 50% ของแอลกอฮอล์ที่ผลิตได้ แล้วผลิตใหม่แล้วนำมาผสมกับแอลกอฮอล์เก่าที่เก็บไว้ทำให้รสชาติกลิ่นคงที่",
    "แล้วผลิตใหม่ แล้วนำมาผสมกับแอลกอฮอล์เก่าที่เก็บไว้ทำให้รสชาติกลิ่นคงที่"
  ];

  return defaultSteps.map(function(text) {
    return { text: text, color: "blue" };
  });
}

/**
 * Save updated checklist steps template back to spreadsheet
 */
function saveChecklistTemplate(stepsList) {
  try {
    var ss = getSpreadsheet();
    var sheet = getOrCreateSheetClean(ss, "ขั้นตอนการทำหมักแอลกอฮอล์");
    sheet.appendRow(["ขั้นตอนการทำหมักแอลกอฮอล์"]);
    sheet.appendRow(["ลำดับ", "ขั้นตอน", "ทำเสร็จ", "สี"]);
    stepsList.forEach(function(step, index) {
      var text = (typeof step === 'object') ? step.text : step.toString();
      var color = (typeof step === 'object' && step.color) ? step.color : "blue";
      sheet.appendRow([index + 1, text, false, color]);
    });
    return true;
  } catch (e) {
    Logger.log("Error in saveChecklistTemplate: " + e.toString());
    throw new Error("บันทึกขั้นตอนการหมักล้มเหลว: " + e.toString());
  }
}

/**
 * Returns currently connected spreadsheet details
 */
function getSpreadsheetInfo() {
  try {
    var ss = getSpreadsheet();
    return {
      id: ss.getId(),
      name: ss.getName(),
      url: ss.getUrl()
    };
  } catch (e) {
    return { id: '', name: 'เกิดข้อผิดพลาดในการเชื่อมต่อ', url: '#' };
  }
}

/**
 * Overwrite SPREADSHEET_ID in properties and return status
 */
function setSpreadsheetId(id) {
  try {
    var ss = SpreadsheetApp.openById(id);
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
    return { success: true, name: ss.getName() };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
/**
 * Validate username and password against the Users sheet
 */
function validateLogin(username, password) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName("Users");
    if (!sheet) {
      sheet = ss.insertSheet("Users");
      sheet.appendRow(["Username", "Password"]);
      sheet.appendRow(["admin", "admin123"]); // Default user
    }
    
    var vals = sheet.getDataRange().getValues();
    var lowerUsername = username.trim().toLowerCase();
    
    var userFound = false;
    for (var i = 1; i < vals.length; i++) {
      var u = vals[i][0] ? vals[i][0].toString().trim().toLowerCase() : '';
      var p = vals[i][1] ? vals[i][1].toString().trim() : '';
      if (u === lowerUsername) {
        userFound = true;
        if (p === password.trim()) {
          return { success: true, username: vals[i][0].toString().trim() };
        }
      }
    }
    
    // Auto-create "pattarawin" user if not found
    if (!userFound && lowerUsername === 'pattarawin') {
      sheet.appendRow(["pattarawin", password.trim()]);
      return { success: true, username: "pattarawin" };
    }
    
    return { success: false, error: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" };
  } catch (e) {
    return { success: false, error: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: " + e.toString() };
  }
}

/**
 * Register a new user in the Users sheet
 */
function registerUser(username, password) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName("Users");
    if (!sheet) {
      sheet = ss.insertSheet("Users");
      sheet.appendRow(["Username", "Password"]);
    }
    
    var vals = sheet.getDataRange().getValues();
    var lowerUsername = username.trim().toLowerCase();
    
    for (var i = 1; i < vals.length; i++) {
      var u = vals[i][0] ? vals[i][0].toString().trim().toLowerCase() : '';
      if (u === lowerUsername) {
        return { success: false, error: "ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว" };
      }
    }
    
    sheet.appendRow([username.trim(), password.trim()]);
    return { success: true };
  } catch (e) {
    return { success: false, error: "เกิดข้อผิดพลาดในการสมัครสมาชิก: " + e.toString() };
  }
}

/**
 * ฟังก์ชันจัดการสต๊อกวัตถุดิบ (IngredientStock)
 */
function getOrCreateStockSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("IngredientStock");
  var headers = ['ID', 'Name', 'Category', 'Quantity', 'Unit', 'MinQuantity', 'Price', 'Supplier', 'Note', 'UpdatedAt', 'Username'];
  
  if (!sheet) {
    sheet = ss.insertSheet("IngredientStock");
    sheet.appendRow(headers);
  } else {
    var data = sheet.getDataRange().getValues();
    var hasHeaders = false;
    if (data && data.length > 0 && data[0].length > 0) {
      if (data[0][0] === 'ID' && data[0][1] === 'Name') {
        hasHeaders = true;
      }
    }
    if (!hasHeaders) {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(headers);
      } else {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
    }
  }
  return sheet;
}

// 1. ดึงข้อมูลวัตถุดิบทั้งหมดของผู้ใช้
function getIngredientStock(username) {
  try {
    var sheet = getOrCreateStockSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    var headers = data[0];
    var list = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var item = {};
      for (var j = 0; j < headers.length; j++) {
        item[headers[j]] = row[j];
      }
      
      // ฟิลเตอร์ตามชื่อผู้ใช้
      if (!username || item.Username === username) {
        item.Quantity = parseFloat(item.Quantity) || 0;
        item.MinQuantity = parseFloat(item.MinQuantity) || 0;
        item.Price = parseFloat(item.Price) || 0;
        list.push(item);
      }
    }
    return list;
  } catch (e) {
    Logger.log("getIngredientStock error: " + e.toString());
    return [];
  }
}

// 2. บันทึก / แก้ไขวัตถุดิบ
function saveIngredientItem(item, username) {
  try {
    var sheet = getOrCreateStockSheet();
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var idIndex = headers.indexOf('ID');
    var updatedAt = new Date();
    
    var rowData = [
      item.ID || "ING-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000),
      item.Name || "",
      item.Category || "อื่นๆ",
      parseFloat(item.Quantity) || 0,
      item.Unit || "กก.",
      parseFloat(item.MinQuantity) || 0,
      parseFloat(item.Price) || 0,
      item.Supplier || "",
      item.Note || "",
      updatedAt,
      username || "unknown"
    ];
    
    var foundIndex = -1;
    if (item.ID) {
      for (var i = 1; i < data.length; i++) {
        if (data[i][idIndex] === item.ID) {
          foundIndex = i + 1; // 1-based index for sheet row
          break;
        }
      }
    }
    
    if (foundIndex > 0) {
      sheet.getRange(foundIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return { success: true, item: { ID: rowData[0], Name: rowData[1], Quantity: rowData[3] } };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 3. ปรับสต๊อกวัตถุดิบ (บวก/ลบ/ตั้งค่า)
function adjustIngredientQuantity(id, adjustType, amount, note, username) {
  try {
    var sheet = getOrCreateStockSheet();
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var idIndex = headers.indexOf('ID');
    var qtyIndex = headers.indexOf('Quantity');
    var noteIndex = headers.indexOf('Note');
    var updateIndex = headers.indexOf('UpdatedAt');
    
    var foundIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][idIndex] === id) {
        foundIndex = i + 1;
        break;
      }
    }
    
    if (foundIndex === -1) {
      return { success: false, error: "ไม่พบวัตถุดิบที่ต้องการปรับสต๊อก" };
    }
    
    var currentQty = parseFloat(sheet.getRange(foundIndex, qtyIndex + 1).getValue()) || 0;
    var adjustAmount = parseFloat(amount) || 0;
    var newQty = currentQty;
    
    if (adjustType === 'add') {
      newQty = currentQty + adjustAmount;
    } else if (adjustType === 'subtract') {
      newQty = currentQty - adjustAmount;
      if (newQty < 0) newQty = 0;
    } else if (adjustType === 'set') {
      newQty = adjustAmount;
    }
    
    sheet.getRange(foundIndex, qtyIndex + 1).setValue(newQty);
    sheet.getRange(foundIndex, updateIndex + 1).setValue(new Date());
    
    var logNote = (adjustType === 'add' ? "+" : adjustType === 'subtract' ? "-" : "=") + adjustAmount + " (" + (note || "ปรับปรุงสต๊อก") + ")";
    sheet.getRange(foundIndex, noteIndex + 1).setValue(logNote);
    
    return { success: true, newQuantity: newQty };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 4. ลบวัตถุดิบ
function deleteIngredientItem(id, username) {
  try {
    var sheet = getOrCreateStockSheet();
    var data = sheet.getDataRange().getValues();
    var idIndex = data[0].indexOf('ID');
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][idIndex] === id) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: "ไม่พบวัตถุดิบที่ต้องการลบ" };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * ฟังก์ชันจัดการหน่วยวัตถุดิบ (IngredientUnits)
 */
function getOrCreateUnitsSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName("IngredientUnits");
  var headers = ['UnitName', 'Username'];
  
  if (!sheet) {
    sheet = ss.insertSheet("IngredientUnits");
    sheet.appendRow(headers);
    var defaults = [['กก.', 'admin'], ['กรัม', 'admin'], ['ลิตร', 'admin'], ['มล.', 'admin'], ['ถุง', 'admin'], ['แพ็ค', 'admin'], ['กล่อง', 'admin']];
    defaults.forEach(function(row) {
      sheet.appendRow(row);
    });
  }
  return sheet;
}

// 1. ดึงหน่วยวัตถุดิบทั้งหมด (ของระบบ + ของผู้ใช้)
function getIngredientUnits(username) {
  try {
    var sheet = getOrCreateUnitsSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    var list = [];
    var added = {};
    
    for (var i = 1; i < data.length; i++) {
      var name = data[i][0] ? data[i][0].toString().trim() : "";
      var user = data[i][1] ? data[i][1].toString().trim().toLowerCase() : "";
      
      if (!name) continue;
      
      var targetUser = username ? username.trim().toLowerCase() : "";
      if (user === 'admin' || user === targetUser) {
        if (!added[name]) {
          added[name] = true;
          list.push({ UnitName: name, Username: user });
        }
      }
    }
    return list;
  } catch (e) {
    Logger.log("getIngredientUnits error: " + e.toString());
    return [];
  }
}

// 2. เพิ่มหน่วยวัดใหม่
function addIngredientUnit(unitName, username) {
  try {
    var name = unitName.trim();
    if (!name) return { success: false, error: "ชื่อหน่วยวัดห้ามว่างเปล่า" };
    
    var sheet = getOrCreateUnitsSheet();
    var data = sheet.getDataRange().getValues();
    var targetUser = username ? username.trim().toLowerCase() : "unknown";
    
    for (var i = 1; i < data.length; i++) {
      var uName = data[i][0] ? data[i][0].toString().trim().toLowerCase() : "";
      var uUser = data[i][1] ? data[i][1].toString().trim().toLowerCase() : "";
      if (uName === name.toLowerCase() && (uUser === 'admin' || uUser === targetUser)) {
        return { success: false, error: "หน่วยวัดนี้มีอยู่ในระบบแล้ว" };
      }
    }
    
    sheet.appendRow([name, username || "unknown"]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// 3. ลบหน่วยวัด
function deleteIngredientUnit(unitName, username) {
  try {
    var name = unitName.trim();
    var sheet = getOrCreateUnitsSheet();
    var data = sheet.getDataRange().getValues();
    var targetUser = username ? username.trim().toLowerCase() : "";
    
    for (var i = 1; i < data.length; i++) {
      var uName = data[i][0] ? data[i][0].toString().trim() : "";
      var uUser = data[i][1] ? data[i][1].toString().trim().toLowerCase() : "";
      
      if (uName === name && uUser === targetUser) {
        if (uUser === 'admin') {
          return { success: false, error: "ไม่สามารถลบหน่วยวัดที่เป็นของระบบเริ่มต้นได้" };
        }
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: "ไม่พบหน่วยวัดที่ต้องการลบหรือไม่มีสิทธิ์ลบ" };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ==========================================
// 8. SYSTEM SETTINGS & TELEGRAM NOTIFICATION
// ==========================================

function getOrCreateSettingsSheet() {
  var sheet = getOrCreateSheet('SystemSettings');
  var data = sheet.getDataRange().getValues();
  if (data.length === 0 || data[0].length < 4 || data[0][0] !== 'Key') {
    sheet.clear();
    sheet.appendRow(['Key', 'Value', 'Username', 'UpdatedAt']);
  }
  return sheet;
}

function getSystemSettings(username) {
  try {
    var sheet = getOrCreateSettingsSheet();
    var data = sheet.getDataRange().getValues();
    var targetUser = username ? username.trim().toLowerCase() : "";
    var settings = {};
    
    for (var i = 1; i < data.length; i++) {
      var k = data[i][0];
      var v = data[i][1];
      var u = data[i][2] ? data[i][2].toString().trim().toLowerCase() : "";
      if (k && (!u || u === targetUser || u === 'admin')) {
        settings[k] = v;
      }
    }
    return { success: true, settings: settings };
  } catch (e) {
    return { success: false, error: e.toString(), settings: {} };
  }
}

function saveSystemSettings(settings, username) {
  try {
    if (!settings || typeof settings !== 'object') {
      return { success: false, error: "ข้อมูลการตั้งค่าไม่ถูกต้อง" };
    }
    var sheet = getOrCreateSettingsSheet();
    var data = sheet.getDataRange().getValues();
    var updatedAt = new Date().toISOString();
    var userStr = username || "";
    
    for (var key in settings) {
      if (settings.hasOwnProperty(key)) {
        var valStr = typeof settings[key] === 'object' ? JSON.stringify(settings[key]) : String(settings[key]);
        var foundRow = -1;
        
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] === key) {
            foundRow = i + 1;
            break;
          }
        }
        
        if (foundRow > 0) {
          sheet.getRange(foundRow, 2).setValue(valStr);
          sheet.getRange(foundRow, 3).setValue(userStr);
          sheet.getRange(foundRow, 4).setValue(updatedAt);
        } else {
          sheet.appendRow([key, valStr, userStr, updatedAt]);
        }
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function sendTelegramNotification(message, customBotToken, customChatId) {
  try {
    if (!message) {
      return { success: false, error: "ไม่มีข้อความแจ้งเตือน" };
    }
    
    var botToken = customBotToken;
    var chatId = customChatId;
    
    if (!botToken || !chatId) {
      var saved = getSystemSettings("");
      if (saved && saved.settings) {
        if (!botToken) botToken = saved.settings.telegram_bot_token;
        if (!chatId) chatId = saved.settings.telegram_chat_id;
      }
    }
    
    if (!botToken || !chatId) {
      return { success: false, error: "ยังไม่ได้ระบุ Telegram Bot Token หรือ Chat ID" };
    }
    
    var url = "https://api.telegram.org/bot" + botToken.toString().trim() + "/sendMessage";
    var payload = {
      chat_id: chatId.toString().trim(),
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true
    };
    
    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var resData = JSON.parse(response.getContentText());
    
    if (resData.ok) {
      return { success: true, messageId: resData.result.message_id };
    } else {
      return { success: false, error: resData.description || "ส่งข้อความไม่สำเร็จ" };
    }
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function deductBatchStock(batchId, batchTitle, ingredientsList, username) {
  try {
    if (!ingredientsList || !Array.isArray(ingredientsList) || ingredientsList.length === 0) {
      return { success: true, count: 0 };
    }
    
    var stockSheet = getOrCreateStockSheet();
    var stockData = stockSheet.getDataRange().getValues();
    var headers = stockData[0];
    var idIndex = headers.indexOf('ID');
    var nameIndex = headers.indexOf('Name');
    var qtyIndex = headers.indexOf('Quantity');
    var unitIndex = headers.indexOf('Unit');
    var noteIndex = headers.indexOf('Note');
    var updatedIndex = headers.indexOf('UpdatedAt');
    
    var now = new Date().toISOString();
    var todayStr = now.split('T')[0];
    var deducted = [];
    
    for (var k = 0; k < ingredientsList.length; k++) {
      var item = ingredientsList[k];
      var iName = (item.name || "").trim().toLowerCase();
      var rawQty = parseFloat(item.qty) || 0;
      var iUnit = (item.unit || "").trim().toLowerCase();
      
      if (!iName || rawQty <= 0) continue;
      
      var foundRow = -1;
      var stockItemName = "";
      var stockItemUnit = "";
      var currentStockQty = 0;
      
      for (var r = 1; r < stockData.length; r++) {
        var sName = stockData[r][nameIndex] ? stockData[r][nameIndex].toString().trim().toLowerCase() : "";
        if (sName === iName || sName.indexOf(iName) >= 0 || iName.indexOf(sName) >= 0) {
          foundRow = r + 1;
          stockItemName = stockData[r][nameIndex];
          stockItemUnit = stockData[r][unitIndex] ? stockData[r][unitIndex].toString().trim() : "";
          currentStockQty = parseFloat(stockData[r][qtyIndex]) || 0;
          break;
        }
      }
      
      if (foundRow > 0) {
        var deductQty = rawQty;
        var sUnitLower = stockItemUnit.toLowerCase();
        
        // Convert gram <-> kg
        if ((iUnit === 'กรัม' || iUnit === 'g') && (sUnitLower === 'กก.' || sUnitLower === 'kg' || sUnitLower === 'กิโลกรัม')) {
          deductQty = rawQty / 1000.0;
        } else if ((iUnit === 'กก.' || iUnit === 'kg' || iUnit === 'กิโลกรัม') && (sUnitLower === 'กรัม' || sUnitLower === 'g')) {
          deductQty = rawQty * 1000.0;
        }
        // Convert ml <-> Liter
        else if ((iUnit === 'มล.' || iUnit === 'ml') && (sUnitLower === 'ลิตร' || sUnitLower === 'l')) {
          deductQty = rawQty / 1000.0;
        } else if ((iUnit === 'ลิตร' || iUnit === 'l') && (sUnitLower === 'มล.' || sUnitLower === 'ml')) {
          deductQty = rawQty * 1000.0;
        }
        
        var newStockQty = currentStockQty - deductQty;
        if (newStockQty < 0) newStockQty = 0;
        
        var noteStr = "ตัดสต๊อกอัตโนมัติจากแบทช์: " + (batchTitle || batchId || "ไม่ระบุชื่อ");
        
        // Update Sheet
        if (qtyIndex >= 0) stockSheet.getRange(foundRow, qtyIndex + 1).setValue(newStockQty);
        if (noteIndex >= 0) stockSheet.getRange(foundRow, noteIndex + 1).setValue("-" + deductQty.toFixed(2) + " (" + noteStr + ")");
        if (updatedIndex >= 0) stockSheet.getRange(foundRow, updatedIndex + 1).setValue(now);
        
        // Save Stock Movement
        saveStockMovement(stockData[foundRow - 1][idIndex], 'จ่ายออก', deductQty, todayStr, noteStr, username);
        deducted.push(stockItemName);
      }
    }
    
    return { success: true, count: deducted.length, deducted: deducted };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Daily automated check for due fermentation batches
 * Can be triggered daily at 8:00 AM by a time-driven trigger or called from client
 */
function checkDueBatches(username) {
  return checkDueBatchesAndSendTelegram();
}

function checkDueBatchesAndSendTelegram() {
  try {
    var batches = getBatches("");
    if (!batches || !Array.isArray(batches) || batches.length === 0) {
      return { success: true, notifiedCount: 0, notifiedList: [] };
    }
    
    var today = new Date();
    var tz = Session.getScriptTimeZone() || "Asia/Bangkok";
    var todayStr = Utilities.formatDate(today, tz, "yyyy-MM-dd");
    
    var completedStatuses = [
      'เสร็จสมบูรณ์กลั่น', 'เสร็จสมบูรณ์แช่', 'เสร็จสมบูรณ์หมัก',
      'เสร็จสมบูรณ์', 'เสร็จสิ้นการทำโซดา', 'ประวัติกลั่น', 'ประวัติแช่', 'ประวัติหมัก'
    ];
    
    var userProps = PropertiesService.getScriptProperties();
    var notifiedList = [];
    
    for (var i = 0; i < batches.length; i++) {
      var b = batches[i];
      if (!b || completedStatuses.indexOf(b.Status) >= 0) continue;
      
      var raw = {};
      try {
        raw = typeof b.RawData === 'string' ? JSON.parse(b.RawData) : (b.RawData || {});
      } catch(e) {}
      
      var endDate = raw.dateFermentEnd || raw.dateEnd;
      if (!endDate) continue;
      if (typeof endDate === 'string' && endDate.indexOf('T') >= 0) {
        endDate = endDate.split('T')[0];
      }
      
      if (endDate === todayStr) {
        var propKey = "tg_due_notified_" + b.ID + "_" + todayStr;
        if (userProps.getProperty(propKey)) {
          continue; // Already notified today
        }
        
        var type = raw.spiritsType || (b.FormulaType === 10 ? 'โซดา' : 'สุรา');
        var startDate = b.Date || '-';
        var days = b.FermentationDays || raw.fermentationDays || raw.fermentDays || 0;
        
        var msg = "🚨 <b>แจ้งเตือนแบทช์ครบกำหนดหมักวันนี้!</b>\n" +
                  "แบทช์: <b>" + (b.Title || '-') + "</b>\n" +
                  "ประเภท: " + type + "\n" +
                  "สถานะปัจจุบัน: <b>" + (b.Status || '-') + "</b>\n" +
                  "วันที่เริ่มหมัก: " + startDate + "\n" +
                  "สิ้นสุดการหมัก: <b>" + endDate + "</b> (ครบกำหนดวันนี้ ⚠️)\n" +
                  "จำนวนวันที่หมัก (วัน): <b>" + days + " วัน</b>\n" +
                  "📌 ถึงกำหนดเปิดถังหมัก / ตรวจสอบการหมักแล้วครับ";
                  
        var res = sendTelegramNotification(msg);
        if (res && res.success) {
          userProps.setProperty(propKey, "true");
          notifiedList.push(b.Title || b.ID);
        }
      }
    }
    return { success: true, date: todayStr, notifiedCount: notifiedList.length, notifiedList: notifiedList };
  } catch (err) {
    Logger.log("Error in checkDueBatchesAndSendTelegram: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Setup or recreate daily morning trigger for Telegram notification (runs every morning 08:00 AM)
 */
function setupDailyTelegramTrigger() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'checkDueBatchesAndSendTelegram') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
    ScriptApp.newTrigger('checkDueBatchesAndSendTelegram')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();
    return { success: true, message: 'ติดตั้งระบบตรวจเช็คและแจ้งเตือนอัตโนมัติทุก 08:00 น. สำเร็จแล้ว' };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}