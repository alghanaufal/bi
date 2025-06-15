import React, { useEffect, useState, useMemo } from "react";
import { ResponsiveLine } from "@nivo/line";
import Papa from "papaparse";

export default function InfantMortalityChart() {
  const [rawData, setRawData] = useState([]);
  const [selectedKotas, setSelectedKotas] = useState(["SEMUA"]); // Default to showing total for all West Java
  const [availableKotas, setAvailableKotas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Define the target years for the chart
  const years = useMemo(() => ["2018", "2019", "2020", "2021", "2022", "2023"], []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // Fetch the CSV data
    fetch(
      "/dinkes-od_17547_jumlah_kematian_bayi_berdasarkan_kategori_bayi_v1_data.csv"
    )
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP error! Status: ${r.status}`);
        }
        return r.text();
      })
      .then((csv) => {
        // Parse the CSV using PapaParse
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

            // Clean and filter raw data
            const cleaned = data
              .map((row) => ({
                id: row.id?.trim(),
                kode_provinsi: row.kode_provinsi?.trim(),
                nama_provinsi: row.nama_provinsi?.trim(),
                kode_kabupaten_kota: row.kode_kabupaten_kota?.trim(),
                nama_kabupaten_kota: row.nama_kabupaten_kota?.trim(),
                kategori_bayi: row.kategori_bayi?.trim(),
                jumlah_kematian: parseInt(row.jumlah_kematian), // Convert to integer
                satuan: row.satuan?.trim(),
                tahun: row.tahun?.trim(), // Ensure tahun is string for consistent x-axis
              }))
              .filter(
                (r) =>
                  r.nama_provinsi === "JAWA BARAT" && // Filter for West Java
                  r.kategori_bayi === "BAYI" && // Only include 'BAYI' category
                  !isNaN(r.jumlah_kematian) && // Ensure jumlah_kematian is a valid number
                  r.tahun && years.includes(r.tahun) // Filter for relevant years
              );

            // Get unique city names for the dropdown
            const uniqueKotas = [
              ...new Set(cleaned.map((r) => r.nama_kabupaten_kota)),
            ].sort();

            setRawData(cleaned);
            setAvailableKotas(["SEMUA", ...uniqueKotas]); // Add 'SEMUA' option
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
  }, [years]); // Re-run effect if years array changes (though it's memoized)

  // Function to handle multi-select dropdown change (using checkboxes)
  const handleKotaSelection = (kota) => {
    if (kota === "SEMUA") {
      setSelectedKotas(["SEMUA"]); // If 'SEMUA' is selected, clear others
    } else {
      if (selectedKotas.includes("SEMUA")) {
        setSelectedKotas([kota]); // If 'SEMUA' was selected, replace it
      } else if (selectedKotas.includes(kota)) {
        setSelectedKotas(selectedKotas.filter((s) => s !== kota)); // Deselect
      } else {
        setSelectedKotas([...selectedKotas, kota]); // Select
      }
    }
  };

  // Prepare data for Nivo ResponsiveLine component
  const chartData = useMemo(() => {
    // If 'SEMUA' is selected or no specific cities, show total for West Java
    if (selectedKotas.length === 0 || selectedKotas.includes("SEMUA")) {
      const yearlyTotals = years.map((year) => {
        const total = rawData
          .filter((d) => d.tahun === year)
          .reduce((sum, current) => sum + current.jumlah_kematian, 0);
        return { x: year, y: total };
      });
      return [{ id: "Total Jawa Barat", data: yearlyTotals }];
    } else {
      // Show data for selected cities
      return selectedKotas.map((kota) => {
        const yearlyData = years.map((year) => {
          const total = rawData
            .filter((d) => d.nama_kabupaten_kota === kota && d.tahun === year)
            .reduce((sum, current) => sum + current.jumlah_kematian, 0);
          return { x: year, y: total };
        });
        return { id: kota, data: yearlyData };
      });
    }
  }, [rawData, selectedKotas, years]);

  // Loading, Error, and No Data states
  if (isLoading) {
    return (
      <section className="pt-6 pb-8 px-4 flex items-center justify-center h-screen">
        <div className="text-xl font-semibold text-gray-700">Memuat data...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="pt-6 pb-8 px-4 flex items-center justify-center h-screen">
        <div className="text-red-600 text-lg font-semibold p-4 border border-red-300 bg-red-50 rounded-lg shadow-md text-center">
          <p className="mb-2">Error: {error}</p>
          <p>Mohon periksa konsol browser untuk detail lebih lanjut.</p>
          <p className="text-sm mt-2">Pastikan file CSV tersedia di root folder aplikasi.</p>
        </div>
      </section>
    );
  }

  // Handle case where no data is available after filtering/parsing
  if (rawData.length === 0) {
    return (
      <section className="pt-6 pb-8 px-4 flex items-center justify-center h-screen">
        <div className="text-gray-600 text-lg p-4 border border-gray-300 bg-gray-50 rounded-lg shadow-md text-center">
          <p>Tidak ada data kematian bayi yang ditemukan untuk Jawa Barat (2018-2023).</p>
          <p className="text-sm mt-2">Mohon pastikan data CSV valid dan sesuai kriteria.</p>
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
              Tren Angka Kematian Bayi di Jawa Barat
            </h2>
            <p className="text-md text-gray-600">
              Visualisasi perubahan angka kematian bayi per tahun (2018-2023).
            </p>
          </div>
          <div className="relative inline-block text-left w-full sm:w-auto">
            <label htmlFor="kota-select" className="block text-sm font-medium text-gray-700 mb-1">
              Pilih Kabupaten/Kota:
            </label>
            <div
              className="max-h-60 overflow-y-auto border border-gray-300 rounded-md bg-white shadow-sm p-3 space-y-2"
              role="listbox"
              aria-labelledby="kota-select-label"
            >
              {availableKotas.map((kota) => (
                <div key={kota} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`checkbox-${kota}`}
                    value={kota}
                    checked={selectedKotas.includes(kota)}
                    onChange={() => handleKotaSelection(kota)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor={`checkbox-${kota}`} className="ml-2 block text-sm text-gray-900 cursor-pointer">
                    {kota}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ height: 500 }} className="w-full">
          {chartData[0]?.data.some(d => d.y > 0) ? ( // Check if there's actual data to display
            <ResponsiveLine
              data={chartData}
              margin={{ top: 50, right: 110, bottom: 90, left: 80 }}
              xScale={{ type: "point" }}
              yScale={{
                type: "linear",
                min: "auto",
                max: "auto",
                stacked: false,
                reverse: false,
              }}
              yFormat=" >-.2f"
              curve="monotoneX" // Smooth curve
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: "Tahun",
                legendOffset: 36,
                legendPosition: "middle",
                truncateTickAt: 0,
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 5,
                tickRotation: 0,
                legend: "Jumlah Kematian Bayi (Orang)",
                legendOffset: -60,
                legendPosition: "middle",
                truncateTickAt: 0,
              }}
              pointSize={8}
              pointColor={{ theme: "background" }}
              pointBorderWidth={2}
              pointBorderColor={{ from: "serieColor" }}
              pointLabelYOffset={-12}
              enableGridX={false}
              enableGridY={true}
              colors={{ scheme: "paired" }} // Use a color scheme that works well for multiple lines
              lineWidth={3} // Make lines a bit thicker
              useMesh={true}
              tooltip={({ point }) => (
                <div
                  style={{
                    background: "white",
                    padding: "10px 14px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  className="font-inter text-sm"
                >
                  <strong>{point.serieId}</strong> <br />
                  Tahun: <strong>{point.data.xFormatted}</strong> <br />
                  Kematian: <strong>{point.data.yFormatted}</strong> orang
                </div>
              )}
              legends={[
                {
                  anchor: "bottom-right",
                  direction: "column",
                  justify: false,
                  translateX: 100,
                  translateY: 0,
                  itemsSpacing: 0,
                  itemDirection: "left-to-right",
                  itemWidth: 80,
                  itemHeight: 20,
                  itemOpacity: 0.75,
                  symbolSize: 12,
                  symbolShape: "circle",
                  symbolBorderColor: "rgba(0, 0, 0, .5)",
                  effects: [
                    {
                      on: "hover",
                      style: {
                        itemBackground: "rgba(0, 0, 0, .03)",
                        itemOpacity: 1,
                      },
                    },
                  ],
                },
              ]}
              // Zoom and trend projection are advanced features not natively supported by Nivo's ResponsiveLine
              // and would require custom implementation (e.g., d3-zoom for zoom, separate library for regression)
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Tidak ada data kematian bayi untuk ditampilkan berdasarkan pilihan saat ini.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
