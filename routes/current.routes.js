const express = require("express");
const router = express.Router();

const { getCurrentData } = require("../controllers/index");

/**
 * @swagger
 * /current:
 *   get:
 *     summary: Get current data
 *     description: |
 *       Mengambil data arus (ampere) dari tabel `power_meter` berdasarkan parameter tanggal:
 *
 *       **Mode:**
 *       - Tanpa parameter → ambil data per jam hari ini
 *       - `?startDate=YYYY-MM-DD` → ambil data per jam pada hari tersebut
 *       - `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` → ambil data maksimum per hari di rentang tanggal
 *       - `?endDate=YYYY-MM-DD` tanpa `startDate` → error (400)
 *     tags: [Power Monitoring]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal awal (opsional)
 *         example: "2025-10-06"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
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
 *                   label: "Current"
 *                   data:
 *                     - time_label: "08:00:00"
 *                       current1: 220.5
 *                       date: "2025-10-08"
 *                     - time_label: "09:00:00"
 *                       current1: 221.2
 *                       date: "2025-10-08"
 *               StartDateSaja:
 *                 summary: Data per jam pada hari tertentu
 *                 value:
 *                   status: "success"
 *                   message: "Data pada tanggal 2025-10-07 berhasil diambil"
 *                   label: "Current"
 *                   data:
 *                     - time_label: "08:00:00"
 *                       current1: 219.9
 *                       date: "2025-10-07"
 *                     - time_label: "09:00:00"
 *                       current1: 220.4
 *                       date: "2025-10-07"
 *               StartDanEnd:
 *                 summary: Data harian antara dua tanggal
 *                 value:
 *                   status: "success"
 *                   message: "Data dari 2025-10-01 hingga 2025-10-07 berhasil diambil"
 *                   label: "Current"
 *                   data:
 *                     - date: "2025-10-01"
 *                       current1: 220.3
 *                     - date: "2025-10-02"
 *                       current1: 221.0
 *       400:
 *         description: Parameter salah
 *         content:
 *           application/json:
 *             example:
 *               status: "failed"
 *               message: "Parameter 'startDate' wajib diisi jika 'endDate' dikirim"
 *               data: []
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             example:
 *               error: "Internal Server Error"
 */

router.get("/current", getCurrentData);

module.exports = router;
