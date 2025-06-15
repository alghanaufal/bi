import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Papa from "papaparse";
import * as d3 from "d3"; // Import D3 for binning

export default function ImmunizationCoverageHistogram() {
  const [rawData, setRawData] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [availableYears, setAvailableYears] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const CSV_URL =
    "/dinkes-od_17464_jml_bayi_mendapat_imunisasi_dasar_lengkap__jk_v1_data.csv";

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    fetch(CSV_URL)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP error! Status: ${r.status}`);
        }
        return r.text();
      })
      .then((csv) => {
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          complete: ({ data, errors }) => {
            if (errors.length > 0) {
              console.error("Error parsing CSV:", errors);
              setError("Terjadi kesalahan saat mengurai data CSV.");
              setIsLoading(false);
              return;
            }

            const cleaned = data
              .map((row) => ({
                nama_kabupaten_kota: row.nama_kabupaten_kota?.trim(),
                jenis_kelamin: row.jenis_kelamin?.trim(),
                jumlah_bayi: parseInt(row.jumlah_bayi), // Convert to integer
                tahun: row.tahun?.trim(),
                provinsi: row.nama_provinsi?.trim(),
              }))
              .filter(
                (r) =>
                  r.provinsi === "JAWA BARAT" &&
                  !isNaN(r.jumlah_bayi) &&
                  r.jumlah_bayi >= 0 && // Ensure non-negative numbers for binning
                  r.nama_kabupaten_kota &&
                  r.tahun
              );

            const uniqueYears = [...new Set(cleaned.map((r) => r.tahun))].sort(
              (a, b) => b - a
            );

            setRawData(cleaned);
            setAvailableYears(uniqueYears);
            if (uniqueYears.length > 0) {
              setSelectedYear(uniqueYears[0]); // Set latest year as default
            }
            setIsLoading(false);
          },
          error: (err) => {
            console.error("Error PapaParse:", err);
            setError("Terjadi kesalahan saat memproses data CSV.");
            setIsLoading(false);
          },
        });
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setError(
          `Gagal memuat data: ${err.message}. Pastikan file CSV tersedia di path yang benar.`
        );
        setIsLoading(false);
      });
  }, []);

  // Prepare data for Recharts BarChart to act as a Histogram
  const histogramData = useMemo(() => {
    if (!rawData.length || !selectedYear) {
      return [];
    }

    // Filter by selected year
    const filteredByYear = rawData.filter((d) => d.tahun === selectedYear);

    // Aggregate jumlah_bayi per kabupaten/kota for the selected year
    const aggregatedByKota = filteredByYear.reduce((acc, curr) => {
      const kotaKey = curr.nama_kabupaten_kota;
      if (!acc[kotaKey]) {
        acc[kotaKey] = 0;
      }
      acc[kotaKey] += curr.jumlah_bayi; // Summing up male and female counts
      return acc;
    }, {});

    // Get all aggregated values for binning
    const values = Object.values(aggregatedByKota);

    if (values.length === 0) {
      return []; // No data to bin
    }

    // Define the binning function using D3
    // Use d3.extent to find min and max values for the domain
    const [minVal, maxVal] = d3.extent(values);

    // Create a bin generator. You can adjust `thresholds` for more/fewer bins.
    const binGenerator = d3
      .bin()
      .domain([minVal, maxVal + (maxVal === minVal ? 1 : 0)]) // Ensure domain has width even if all values are same
      .thresholds(10); // Generate 10 bins (adjust this number as needed)

    // Apply the binning to your values
    const bins = binGenerator(values);

    // Format bins for Recharts BarChart
    // Each bin becomes an object with a 'range' for X-axis and 'count' for Y-axis
    const formattedBins = bins
      .map((bin) => ({
        // Example: range "1000 - 2000"
        range: `${Math.floor(bin.x0)} - ${Math.floor(bin.x1)}`,
        count: bin.length, // Number of cities in this bin
        x0: bin.x0, // For custom tooltip sorting/display
        x1: bin.x1, // For custom tooltip sorting/display
      }))
      .filter((b) => b.count > 0); // Only include bins that actually contain data

    // Sort bins by their lower bound (x0) to ensure correct order on the histogram
    formattedBins.sort((a, b) => a.x0 - b.x0);

    return formattedBins;
  }, [rawData, selectedYear]);

  // Custom Tooltip for Recharts Histogram
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          style={{
            background: "white",
            padding: 12,
            border: "1px solid #ccc",
            borderRadius: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
          className="font-inter text-sm"
        >
          Jumlah Bayi Imunisasi: <strong>{data.range} orang</strong>
          <br />
          Jumlah Kabupaten/Kota: <strong>{data.count}</strong>
        </div>
      );
    }
    return null;
  };

  // Loading, Error, and No Data states
  if (isLoading) {
    return (
      <section className="pt-6 pb-8 px-4 flex items-center justify-center h-screen">
        <div className="text-xl font-semibold text-gray-700">
          Memuat data...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pt-6 pb-8 px-4 flex items-center justify-center h-screen">
        <div className="text-red-600 text-lg font-semibold p-4 border border-red-300 bg-red-50 rounded-lg shadow-md text-center">
          <p className="mb-2">Error: {error}</p>
          <p>Mohon periksa konsol browser untuk detail lebih lanjut.</p>
          <p className="text-sm mt-2">
            Pastikan file CSV tersedia di root folder aplikasi.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-6 pb-8 px-4 font-inter bg-gray-50 min-h-screen">
      <div className="container mx-auto bg-white p-6 rounded-lg shadow-xl border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-1">
              Distribusi Jumlah Bayi Imunisasi Dasar Lengkap
            </h2>
            <p className="text-md text-gray-600">
              Menganalisis distribusi jumlah bayi yang mendapatkan imunisasi
              dasar lengkap di kabupaten/kota Jawa Barat.
            </p>
          </div>
          <div className="relative inline-block text-left w-full sm:w-auto">
            <label
              htmlFor="year-select"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Pilih Tahun:
            </label>
            <select
              id="year-select"
              className="border border-gray-300 px-4 py-2 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700 hover:border-gray-400 transition duration-150 ease-in-out w-full sm:w-auto"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {availableYears.length > 0 ? (
                availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))
              ) : (
                <option value="">Tidak ada tahun tersedia</option>
              )}
            </select>
          </div>
        </div>

        <div style={{ height: 500 }} className="w-full">
          {histogramData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={histogramData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 50,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="range"
                  angle={-45} // Rotate labels
                  textAnchor="end" // Align rotated labels
                  interval={0} // Show all labels
                  height={80} // Give more space for rotated labels
                  tick={{ fontSize: 12, fill: "#666" }}
                  label={{
                    value: "Jumlah Bayi Imunisasi (orang)",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#333",
                    fontSize: 14,
                  }}
                />
                <YAxis
                  allowDecimals={false} // Count should be integer
                  tick={{ fontSize: 12, fill: "#666" }}
                  label={{
                    value: "Jumlah Kabupaten/Kota",
                    angle: -90,
                    position: "insideLeft",
                    offset: 10,
                    fill: "#333",
                    fontSize: 14,
                  }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "transparent" }}
                />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Tidak ada data imunisasi bayi yang tersedia untuk tahun{" "}
              {selectedYear}.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
