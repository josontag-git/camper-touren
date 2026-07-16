// In das Google Sheet einfuegen unter: Erweiterungen -> Apps Script
// Danach als Web App (neu) deployen ("Ausfuehren als: Ich", "Zugriff: Jeder")
// -- siehe README.md im Projekt-Root. Die angezeigte /exec-URL kommt in die
// Einstellungen der App (Zahnrad-Symbol), nicht in den Code.

const SHEET_TRIPS = "Trips";
const TRIPS_HEADERS = ["id", "name", "startDate", "endDate", "note", "createdAt", "updatedAt"];

const SHEET_PLACES = "Places";
const PLACES_HEADERS = [
  "id", "tripId", "order", "name", "lat", "lng", "address",
  "category", "arrivalDate", "departureDate", "note", "placeId", "createdAt",
];

function doGet(e) {
  return jsonResponse({
    trips: readSheet(SHEET_TRIPS, TRIPS_HEADERS),
    places: readSheet(SHEET_PLACES, PLACES_HEADERS),
  });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const sheetName = data.entity === "place" ? SHEET_PLACES : SHEET_TRIPS;
  const headers = data.entity === "place" ? PLACES_HEADERS : TRIPS_HEADERS;
  const sheet = getOrCreateSheet(sheetName, headers);

  if (data.action === "delete") {
    deleteRowById(sheet, data.data.id);
  } else {
    upsertRow(sheet, headers, data.data);
  }

  return jsonResponse({ status: "ok" });
}

function readSheet(name, headers) {
  const sheet = getOrCreateSheet(name, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return rows
    .filter((row) => row[0] !== "")
    .map((row) => {
      const obj = {};
      headers.forEach((key, i) => { obj[key] = row[i]; });
      return obj;
    });
}

function upsertRow(sheet, headers, record) {
  const row = headers.map((key) => record[key] ?? "");
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === record.id) {
        sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
        return;
      }
    }
  }
  sheet.appendRow(row);
}

function deleteRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) {
      sheet.deleteRow(i + 2);
      return;
    }
  }
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
