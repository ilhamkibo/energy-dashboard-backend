const moment = require("moment-timezone");

/**
 * Format tanggal menjadi timezone Asia/Jakarta (WIB)
 * @param {Array} rows - array hasil query MySQL
 * @param {string} dateKey - nama kolom tanggal (default: "date")
 * @param {string} format - format output (default: "YYYY-MM-DD")
 * @returns {Array} rows dengan tanggal yang sudah diformat
 */
function formatRowsToJakartaTime(
  rows,
  dateKey = "date",
  format = "YYYY-MM-DD"
) {
  return rows.map((r) => ({
    ...r,
    [dateKey]: r[dateKey]
      ? moment.tz(r[dateKey], "Asia/Jakarta").format(format)
      : null,
  }));
}

module.exports = { formatRowsToJakartaTime };
