const express = require("express");
const router = express.Router();

const { getWattData } = require("../controllers/index");

/**
 * @swagger
 * /watt:
 *   get:
 *     summary: Get watt data
 *     description: |
 *       Mengambil data daya aktif (watt) dari tabel `power_meter` berdasarkan parameter tanggal:
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
 *                   label: "Watt"
 *                   data:
 *                     - time_label: "08:00:00"
 *                       watt1: 145.2
 *                       date: "2025-10-08"
 *                     - time_label: "09:00:00"
 *                       watt1: 152.6
 *                       date: "2025-10-08"
 *               StartDateSaja:
 *                 summary: Data per jam pada hari tertentu
 *                 value:
 *                   status: "success"
 *                   message: "Data pada tanggal 2025-10-07 berhasil diambil"
 *                   label: "Watt"
 *                   data:
 *                     - time_label: "08:00:00"
 *                       watt1: 140.5
 *                       date: "2025-10-07"
 *                     - time_label: "09:00:00"
 *                       watt1: 149.3
 *                       date: "2025-10-07"
 *               StartDanEnd:
 *                 summary: Data harian antara dua tanggal
 *                 value:
 *                   status: "success"
 *                   message: "Data dari 2025-10-01 hingga 2025-10-07 berhasil diambil"
 *                   label: "Watt"
 *                   data:
 *                     - date: "2025-10-01"
 *                       watt1: 141.2
 *                     - date: "2025-10-02"
 *                       watt1: 152.7
 *                     - date: "2025-10-03"
 *                       watt1: 148.9
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

router.get("/watt", getWattData);

module.exports = router;
