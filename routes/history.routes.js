const express = require("express");
const router = express.Router();

const { getHistoryData } = require("../controllers/index");

/**
 * @swagger
 * /history:
 *   get:
 *     summary: Get historical power meter and temperature data
 *     description: |
 *       Mengambil **data historis** dari tabel `power_meter` dan `temp_control`, mencakup beberapa parameter (volt, ampere, watt, kva, freq, temp) berdasarkan rentang tanggal.
 *
 *       **Mode Pengambilan Data:**
 *       - 🔹 **Tanpa parameter** → ambil data **per jam** untuk hari ini
 *       - 🔹 **?startDate=YYYY-MM-DD** → ambil data **per jam** pada hari tertentu
 *       - 🔹 **?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD** → ambil data **per hari** dalam rentang tanggal
 *       - 🔹 **?endDate=YYYY-MM-DD** tanpa `startDate` → error (400)
 *
 *     tags: [Power Monitoring]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Tanggal awal (opsional)
 *         example: "2025-10-06"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Tanggal akhir (opsional)
 *         example: "2025-10-08"
 *     responses:
 *       200:
 *         description: Data berhasil diambil
 *         content:
 *           application/json:
 *             examples:
 *               TanpaParameter:
 *                 summary: Data hari ini (per jam)
 *                 value:
 *                   status: "success"
 *                   message: "Data hari ini berhasil diambil"
 *                   label: "History Data"
 *                   data:
 *                     - volt:
 *                         - value: 220.3
 *                           time_label: "08:00:00"
 *                         - value: 221.1
 *                           time_label: "09:00:00"
 *                     - kva:
 *                         - value: 11.9
 *                           time_label: "08:00:00"
 *                         - value: 12.3
 *                           time_label: "09:00:00"
 *                     - watt:
 *                         - value: 1200.5
 *                           time_label: "08:00:00"
 *                         - value: 1225.8
 *                           time_label: "09:00:00"
 *                     - freq:
 *                         - value: 49.9
 *                           time_label: "08:00:00"
 *                         - value: 50.1
 *                           time_label: "09:00:00"
 *                     - temp:
 *                         - value: 35.2
 *                           time_label: "08:00:00"
 *                         - value: 36.1
 *                           time_label: "09:00:00"
 *                     - ampere:
 *                         - value: 5.3
 *                           time_label: "08:00:00"
 *                         - value: 5.4
 *                           time_label: "09:00:00"
 *               StartDateSaja:
 *                 summary: Data per jam pada hari tertentu
 *                 value:
 *                   status: "success"
 *                   message: "Data pada tanggal 2025-10-07 berhasil diambil"
 *                   label: "History Data"
 *                   data:
 *                     - volt:
 *                         - value: 219.8
 *                           time_label: "08:00:00"
 *                         - value: 220.6
 *                           time_label: "09:00:00"
 *                     - temp:
 *                         - value: 34.8
 *                           time_label: "08:00:00"
 *                         - value: 35.4
 *                           time_label: "09:00:00"
 *                     - watt:
 *                         - value: 1180.4
 *                           time_label: "08:00:00"
 *                         - value: 1210.7
 *                           time_label: "09:00:00"
 *               StartDanEnd:
 *                 summary: Data harian antara dua tanggal
 *                 value:
 *                   status: "success"
 *                   message: "Data dari 2025-10-01 hingga 2025-10-07 berhasil diambil"
 *                   label: "History Data"
 *                   data:
 *                     - volt:
 *                         - value: 220.1
 *                           time_label: "2025-10-01"
 *                         - value: 221.2
 *                           time_label: "2025-10-02"
 *                     - watt:
 *                         - value: 1200.5
 *                           time_label: "2025-10-01"
 *                         - value: 1225.2
 *                           time_label: "2025-10-02"
 *                     - temp:
 *                         - value: 35.5
 *                           time_label: "2025-10-01"
 *                         - value: 36.2
 *                           time_label: "2025-10-02"
 *       400:
 *         description: Parameter salah
 *         content:
 *           application/json:
 *             example:
 *               status: "failed"
 *               message: "Parameter 'startDate' wajib diisi jika 'endDate' dikirim"
 *               data: []
 *       500:
 *         description: Kesalahan server
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

router.get("/history", getHistoryData);

module.exports = router;
