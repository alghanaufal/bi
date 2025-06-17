import React, { useEffect, useState, useRef, useMemo } from "react";
import * as d3 from "d3"; // Import D3.js
import Papa from "papaparse"; // Import PapaParse for CSV

export default function MaternalMortalityD3Map() {
  const svgRef = useRef(null); // Reference to the SVG element
  const tooltipRef = useRef(null); // Reference to the tooltip element

  const [rawData, setRawData] = useState([]);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [selectedYear, setSelectedYear] = useState("");
  const [availableYears, setAvailableYears] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- PENTING: URL untuk Data GeoJSON ---
  const GEOJSON_URL = "/Jabar_By_Kab.geojson"; // <=== PASTIKAN PATH INI BENAR DAN FILE ADA DI FOLDER PUBLIC

  const CSV_URL = "/dinkes-od_19830_jumlah_kematian_ibu_nifas_v1_data.csv"; // <=== PASTIKAN PATH INI BENAR DAN FILE ADA DI FOLDER PUBLIC

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    console.log("Mulai fetch data...");
    // Fetch both CSV and GeoJSON concurrently
    Promise.all([fetch(CSV_URL), fetch(GEOJSON_URL)])
      .then(async ([csvRes, geoJsonRes]) => {
        console.log("CSV Response Status:", csvRes.status);
        console.log("GeoJSON Response Status:", geoJsonRes.status);

        if (!csvRes.ok)
          throw new Error(`HTTP error! Status: ${csvRes.status} for CSV data.`);

        let geoJsonObj = null;
        if (!geoJsonRes.ok) {
          console.warn(
            `GeoJSON not found at ${GEOJSON_URL}. Status: ${geoJsonRes.status}.`
          );
          setError((prev) =>
            prev
              ? prev + " | File GeoJSON tidak ditemukan/tidak dapat diakses."
              : "File GeoJSON tidak ditemukan/tidak dapat diakses. Fitur peta tidak akan ditampilkan."
          );
        } else {
          try {
            geoJsonObj = await geoJsonRes.json();
            // console.log("GeoJSON fetched successfully:", geoJsonObj); // Terlalu verbose, aktifkan jika perlu
            if (
              !geoJsonObj ||
              !geoJsonObj.features ||
              geoJsonObj.features.length === 0
            ) {
              console.error(
                "GeoJSON is empty or invalid (no features array).",
                geoJsonObj
              );
              setError((prev) =>
                prev
                  ? prev + " | GeoJSON kosong atau tidak valid."
                  : "GeoJSON kosong atau tidak valid. Fitur peta tidak akan ditampilkan."
              );
              geoJsonObj = null; // Set to null if invalid to prevent further errors
            }
          } catch (jsonErr) {
            console.error("Error parsing GeoJSON as JSON:", jsonErr);
            setError((prev) =>
              prev
                ? prev + " | Gagal mengurai GeoJSON."
                : "Gagal mengurai GeoJSON. Pastikan formatnya benar."
            );
            geoJsonObj = null;
          }
        }

        const csvText = await csvRes.text();

        // Parse CSV data
        Papa.parse(csvText, {
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
                // Hapus "KABUPATEN " atau "KOTA " dari nama CSV
                nama_kabupaten_kota: row.nama_kabupaten_kota
                  ?.replace(/KABUPATEN /gi, "") // 'gi' untuk global dan case-insensitive
                  ?.trim()
                  .toUpperCase(), // Normalisasi ke UPPERCASE
                jumlah_kematian: parseInt(row.jumlah_kematian),
                tahun: row.tahun?.trim(),
                provinsi: row.nama_provinsi?.trim(),
              }))
              .filter(
                (r) =>
                  r.provinsi === "JAWA BARAT" &&
                  !isNaN(r.jumlah_kematian) &&
                  r.nama_kabupaten_kota &&
                  r.tahun
              );
            // console.log("Cleaned CSV Data (first 5 rows):", cleaned.slice(0, 5)); // Terlalu verbose
            // Log unique city names from CSV for direct comparison
            const uniqueCsvKotas = [
              ...new Set(cleaned.map((d) => d.nama_kabupaten_kota)),
            ].sort();
            console.log("--- CSV KOTA NAMES (Normalized and Cleaned) ---");
            console.log(uniqueCsvKotas);
            console.log("Total CSV Kotas:", uniqueCsvKotas.length);

            const uniqueYears = [...new Set(cleaned.map((r) => r.tahun))].sort(
              (a, b) => b - a
            );

            setRawData(cleaned);
            setAvailableYears(uniqueYears);
            if (uniqueYears.length > 0) {
              setSelectedYear(uniqueYears[0]); // Set latest year as default
            }

            if (geoJsonObj) {
              // Pre-process GeoJSON: Ensure 'id' property is set from KABKOT for matching
              const processedGeoJson = {
                ...geoJsonObj,
                features: geoJsonObj.features.map((feature) => {
                  if (feature.properties && feature.properties.KABKOT) {
                    feature.id = feature.properties.KABKOT.trim().toUpperCase(); // Gunakan KABKOT sebagai ID dan normalisasi ke UPPERCASE
                  } else if (feature.id) {
                    feature.id = feature.id.trim().toUpperCase(); // Trim dan normalisasi ke UPPERCASE
                  } else {
                    console.warn(
                      "GeoJSON feature missing KABKOT property or ID (after processing):",
                      feature
                    );
                  }
                  return feature;
                }),
              };
              setGeoJsonData(processedGeoJson);
              // Log GeoJSON IDs for direct comparison
              const uniqueGeoJsonIds = [
                ...new Set(processedGeoJson.features.map((f) => f.id)),
              ].sort();
              console.log("--- GEOJSON FEATURE IDs (Processed) ---");
              console.log(uniqueGeoJsonIds);
              console.log("Total GeoJSON Features:", uniqueGeoJsonIds.length);

              // Perform initial comparison check
              const missingInCsv = uniqueGeoJsonIds.filter(
                (id) => !uniqueCsvKotas.includes(id)
              );
              const missingInGeoJson = uniqueCsvKotas.filter(
                (kota) => !uniqueGeoJsonIds.includes(kota)
              );

              if (missingInCsv.length > 0) {
                console.warn(
                  "WARNING: GeoJSON IDs NOT found in CSV data (will be grey):",
                  missingInCsv
                );
              }
              if (missingInGeoJson.length > 0) {
                console.warn(
                  "WARNING: CSV cities NOT found in GeoJSON features (will not be drawn):",
                  missingInGeoJson
                );
              }
              if (
                uniqueCsvKotas.length !== uniqueGeoJsonIds.length ||
                missingInCsv.length > 0 ||
                missingInGeoJson.length > 0
              ) {
                console.warn(
                  "Discrepancy detected between CSV and GeoJSON city lists."
                );
              }
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
          `Gagal memuat data: ${err.message}. Pastikan file CSV dan GeoJSON tersedia di path yang benar.`
        );
        setIsLoading(false);
      });
  }, []); // Runs once on component mount

  // Effect for D3 drawing when data or selectedYear changes
  useEffect(() => {
    if (!geoJsonData || !rawData.length || !selectedYear || !svgRef.current) {
      console.log("Skipping D3 draw: Data not ready.", {
        geoJsonDataLoaded: !!geoJsonData,
        rawDataLoaded: rawData.length > 0,
        selectedYear,
        svgRefCurrent: !!svgRef.current,
      });
      return; // Don't draw if data is not ready
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous map elements

    const width = svg.node().getBoundingClientRect().width;
    const height = svg.node().getBoundingClientRect().height;

    const filteredByYear = rawData.filter((d) => d.tahun === selectedYear);

    const aggregatedData = filteredByYear.reduce((acc, curr) => {
      const kotaId = curr.nama_kabupaten_kota; // This ID is already UPPERCASE and cleaned from initial processing
      if (!acc[kotaId]) {
        acc[kotaId] = 0;
      }
      acc[kotaId] += curr.jumlah_kematian;
      return acc;
    }, {});

    console.log("--- AGGREGATED DATA FOR CURRENT YEAR:", selectedYear, "---");
    console.log(aggregatedData);
    // Log cities from aggregated data that have a value
    console.log(
      "Cities with data and aggregated value > 0 for current year (first 5):",
      Object.keys(aggregatedData)
        .filter((key) => aggregatedData[key] > 0)
        .slice(0, 5)
    );

    const values = Object.values(aggregatedData);
    const maxVal = values.length > 0 ? Math.max(...values) : 1;
    const minVal = values.length > 0 ? Math.min(...values) : 0;

    const colorScale = d3
      .scaleSequential()
      .domain([minVal, maxVal === 0 ? 1 : maxVal])
      .interpolator(d3.interpolateReds);

    const projection = d3.geoMercator().fitSize([width, height], geoJsonData); // Fit map to SVG size based on the entire GeoJSON bounds

    const path = d3.geoPath().projection(projection);

    svg
      .append("g")
      .selectAll("path")
      .data(geoJsonData.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("fill", (d) => {
        // Use KABKOT property for getting the name from GeoJSON, which is also UPPERCASE
        const kotaNameFromGeoJson = d.properties?.KABKOT?.trim().toUpperCase();
        const value = aggregatedData[kotaNameFromGeoJson]; // Use this for lookup
        const fillColor = value !== undefined ? colorScale(value) : "#ccc"; // Grey for no data
        // console.log(`Feature: ${kotaNameFromGeoJson}, Value: ${value}, Fill: ${fillColor}`); // Aktifkan ini untuk debugging per feature
        return fillColor;
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .on("mouseover", function (event, d) {
        const kotaNameFromGeoJson = d.properties?.KABKOT?.trim().toUpperCase();
        const value = aggregatedData[kotaNameFromGeoJson];
        const displayValue = value !== undefined ? value : "Tidak Tersedia";

        const tooltip = d3.select(tooltipRef.current);

        // Get the bounding rectangle of the SVG container (the parent of the tooltip)
        const mapContainerRect =
          svgRef.current.parentElement.getBoundingClientRect();

        // Calculate the adjusted position relative to the map container
        // We add some offset (e.g., +10px, -28px) for better visual placement
        const tooltipX = event.clientX - mapContainerRect.left + 10;
        const tooltipY = event.clientY - mapContainerRect.top - 28; // Adjust based on tooltip height

        tooltip
          .html(
            `<strong>${
              d.properties?.KABKOT || d.id
            }</strong><br/>Tahun: ${selectedYear}<br/>Kematian Ibu: ${displayValue} jiwa`
          )
          .style("left", tooltipX + "px")
          .style("top", tooltipY + "px")
          .style("opacity", 1);

        // Highlight feature on hover
        d3.select(this)
          .attr("fill", (d) => {
            const highlightValue = aggregatedData[kotaNameFromGeoJson];
            return highlightValue !== undefined
              ? d3.rgb(colorScale(highlightValue)).darker(0.5)
              : "#999";
          })
          .attr("stroke", "#000")
          .attr("stroke-width", 1.5);
      })
      .on("mouseout", function (event, d) {
        // Hide tooltip
        d3.select(tooltipRef.current).style("opacity", 0);

        // Revert to original style on mouseout
        d3.select(this)
          .attr("fill", (d) => {
            const kotaNameFromGeoJson =
              d.properties?.KABKOT?.trim().toUpperCase();
            const value = aggregatedData[kotaNameFromGeoJson];
            return value !== undefined ? colorScale(value) : "#ccc";
          })
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.5);
      });

    // Add a simple legend
    const legendWidth = 200;
    const legendHeight = 20;
    const legend = svg
      .append("g")
      .attr(
        "transform",
        `translate(${width - legendWidth - 20}, ${height - legendHeight - 20})`
      );

    const legendScale = d3
      .scaleLinear()
      .domain([minVal, maxVal === 0 ? 1 : maxVal])
      .range([0, legendWidth]);

    legend
      .selectAll("rect")
      .data(d3.range(0, legendWidth, legendWidth / 10))
      .enter()
      .append("rect")
      .attr("x", (d, i) => i * (legendWidth / 10))
      .attr("y", 0)
      .attr("width", legendWidth / 10)
      .attr("height", legendHeight)
      .attr("fill", (d) => colorScale(legendScale.invert(d)));

    legend
      .append("text")
      .attr("x", 0)
      .attr("y", -5)
      .attr("fill", "#333")
      .style("font-size", "10px")
      .text(`${minVal} jiwa`);

    legend
      .append("text")
      .attr("x", legendWidth)
      .attr("y", -5)
      .attr("text-anchor", "end")
      .attr("fill", "#333")
      .style("font-size", "10px")
      .text(`${maxVal} jiwa`);

    legend
      .append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -20)
      .attr("text-anchor", "middle")
      .attr("fill", "#333")
      .style("font-size", "12px")
      .text("Jumlah Kematian Ibu");
  }, [rawData, geoJsonData, selectedYear]); // Re-draw map when these dependencies change

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
            Pastikan file CSV dan GeoJSON tersedia di root folder aplikasi.
          </p>
        </div>
      </section>
    );
  }

  return (
    // Outer section: Make it take full viewport height and be a flex container
    <section className="pt-6 pb-8 px-4 font-inter bg-gray-50 h-screen flex flex-col">
      {/* Inner container: Make it flex-grow to fill remaining space, and scrollable if content overflows */}
      <div className="container mx-auto bg-white p-6 rounded-lg shadow-xl border border-gray-200 flex flex-col flex-grow overflow-y-auto">
        {/* Header section - will take up its natural height */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 flex-shrink-0">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-1">
              Pemetaan Angka Kematian Ibu di Jawa Barat
            </h2>
            <p className="text-md text-gray-600">
              Distribusi jumlah kematian ibu di kabupaten/kota Jawa Barat.
            </p>
          </div>
          <div className="relative inline-block text-left w-full sm:w-auto flex-shrink-0">
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

        {/* Map Container: This will now flex-grow to fill available space */}
        <div
          className="relative w-full rounded-lg overflow-hidden border border-gray-300 shadow-md flex-grow" // flex-grow takes remaining height
          // style={{ height: "800px" }} // Removed fixed height
        >
          <svg ref={svgRef} className="w-full h-full"></svg>
          {/* Tooltip element, controlled by D3 */}
          <div
            ref={tooltipRef}
            className="tooltip absolute p-2 bg-white border border-gray-300 rounded-md shadow-lg pointer-events-none opacity-0 transition-opacity duration-200 ease-in-out"
            style={{ zIndex: 1000 }}
          ></div>
        </div>
      </div>
    </section>
  );
}
