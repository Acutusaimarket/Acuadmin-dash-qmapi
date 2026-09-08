import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// Minimal sampleData for fallback
const sampleData = [
  {
    id: 1,
    SessionID: "session123",
    SupplyID: "supply456",
    SurveyID: "survey789",
    UserID: "user101",
    status: "complete",
    original_cpi: 1.5,
    desired_cpi: 2.0,
    dtectScore: "good",
    country_language: "US-EN",
    ClientStatus: "active",
    InitialStatus: "started",
    surveyProviders: "FUSION",
    IPAddress: "192.168.1.1",
    routed_count: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function SurveyDataTable() {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showError, setShowError] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "descending",
  });

  // New filter states
  const [sourceFilter, setSourceFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState({
    id: "",
    SessionID: "",
    SupplyID: "",
    SurveyID: "",
    UserID: "",
    status: "",
    original_cpi: "",
    desired_cpi: "",
    dtectScore: "",
    country_language: "",
    ClientStatus: "",
    InitialStatus: "",
    surveyProviders: "",
    IPAddress: "",
    createdAt: "",
    updatedAt: "",
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("https://api.qmapi.com/acuadmin");
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const result = await response.json();

        const processedData = (result.data || sampleData).map((item) => {
          // Normalize surveyProviders
          let surveyProviders = item.surveyProviders || "";
          if (typeof surveyProviders === "string") {
            if (surveyProviders.toLowerCase().includes("fusion"))
              surveyProviders = "FUSION";
            else if (surveyProviders.toLowerCase().includes("cint"))
              surveyProviders = "CINT";
            else if (surveyProviders.toLowerCase().includes("pass"))
              surveyProviders = "PASS";
          }

          // If dtectScore is bad and status is NULL, set status to dquality
          let newStatus = item.status;
          if (
            item.dtectScore === "bad" &&
            (!item.status || item.status === "NULL")
          ) {
            newStatus = "dquality";
          }

          return {
            ...item,
            surveyProviders,
            routed_count: item.re_route_count || 0, // Map re_route_count to routed_count
            status: newStatus,
          };
        });

        const sortedData = sortDataByField(
          processedData,
          sortConfig.key,
          sortConfig.direction
        );
        setData(sortedData);
        setFilteredData(sortedData);
        setTotalPages(Math.ceil(sortedData.length / itemsPerPage));
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);

        const processedSampleData = sampleData.map((item) => {
          if (
            item.dtectScore === "bad" &&
            (!item.status || item.status === "NULL")
          ) {
            return { ...item, status: "dquality" };
          }
          return item;
        });

        const sortedData = sortDataByField(
          processedSampleData,
          sortConfig.key,
          sortConfig.direction
        );
        setData(sortedData);
        setFilteredData(sortedData);
        setTotalPages(Math.ceil(sortedData.length / itemsPerPage));
        setError(`Failed to fetch data: ${err.message}`);
        setShowError(true);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter data when any filter changes
  useEffect(() => {
    filterData();
  }, [data, sortConfig, dateRange, sourceFilter, columnFilters]);

  const filterData = () => {
    let filtered = [...data];

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter((item) => {
        if (!item.createdAt) return false;

        try {
          const itemDateTime = new Date(item.createdAt);
          if (isNaN(itemDateTime.getTime())) return false;

          let fromDate = null;
          let toDate = null;

          if (dateRange.from) {
            fromDate = new Date(dateRange.from);
            fromDate.setHours(0, 0, 0, 0);
          }

          if (dateRange.to) {
            toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
          }

          if (fromDate && toDate) {
            return itemDateTime >= fromDate && itemDateTime <= toDate;
          } else if (fromDate) {
            return itemDateTime >= fromDate;
          } else if (toDate) {
            return itemDateTime <= toDate;
          }
          return true;
        } catch (err) {
          console.error("Date filtering error:", err);
          return false;
        }
      });
    }

    // Apply source filter
    if (sourceFilter) {
      filtered = filtered.filter(
        (item) =>
          item.surveyProviders &&
          item.surveyProviders
            .toLowerCase()
            .includes(sourceFilter.toLowerCase())
      );
    }

    // Apply column filters
    Object.keys(columnFilters).forEach((column) => {
      const filterValue = columnFilters[column];
      if (filterValue) {
        filtered = filtered.filter((item) => {
          const itemValue = item[column];
          if (itemValue === null || itemValue === undefined) return false;

          // Handle different data types
          if (column === "original_cpi" || column === "desired_cpi") {
            return itemValue.toString().includes(filterValue);
          } else if (column === "createdAt" || column === "updatedAt") {
            const formattedDate = new Date(itemValue).toLocaleString();
            return formattedDate
              .toLowerCase()
              .includes(filterValue.toLowerCase());
          } else if (column === "status") {
            // Handle display status logic
            const displayStatus = getDisplayStatus(item);
            return displayStatus
              .toLowerCase()
              .includes(filterValue.toLowerCase());
          } else {
            return itemValue
              .toString()
              .toLowerCase()
              .includes(filterValue.toLowerCase());
          }
        });
      }
    });

    filtered = sortDataByField(filtered, sortConfig.key, sortConfig.direction);
    setFilteredData(filtered);
    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    setCurrentPage(1);
  };

  const sortDataByField = (dataToSort, field, direction) => {
    return [...dataToSort].sort((a, b) => {
      if (field === "createdAt" || field === "updatedAt") {
        const dateA = new Date(a[field]);
        const dateB = new Date(b[field]);
        return direction === "ascending" ? dateA - dateB : dateB - dateA;
      }
      if (typeof a[field] === "string" && typeof b[field] === "string") {
        return direction === "ascending"
          ? a[field].localeCompare(b[field])
          : b[field].localeCompare(a[field]);
      }
      return direction === "ascending"
        ? a[field] - b[field]
        : b[field] - a[field];
    });
  };

  const handleDateRangeChange = (field, value) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleColumnFilterChange = (column, value) => {
    setColumnFilters((prev) => ({
      ...prev,
      [column]: value,
    }));
  };

  const handleSort = (key) => {
    // Only allow sorting for createdAt and updatedAt
    if (key !== "createdAt" && key !== "updatedAt") return;

    let direction = "descending";
    if (sortConfig.key === key && sortConfig.direction === "descending") {
      direction = "ascending";
    }
    setSortConfig({ key, direction });
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleItemsPerPageChange = (e) => {
    const value = parseInt(e.target.value);
    setItemsPerPage(value);
    setTotalPages(Math.ceil(filteredData.length / value));
    setCurrentPage(1);
  };

  const exportToExcel = () => {
    setIsExporting(true);

    try {
      const columns = [
        "id",
        "SessionID",
        "SupplyID",
        "SurveyID",
        "UserID",
        "status",
        "original_cpi",
        "desired_cpi",
        "dtectScore",
        "country_language",
        "ClientStatus",
        "InitialStatus",
        "surveyProviders",
        "IPAddress",
        "createdAt",
        "updatedAt",
      ];
      const headers = columns.join(",");

      const rows = filteredData
        .map((row) => {
          return columns
            .map((column) => {
              let cellData = row[column];

              if (
                (column === "createdAt" || column === "updatedAt") &&
                cellData
              ) {
                cellData = new Date(cellData).toLocaleString();
              }

              if (cellData === null || cellData === undefined) {
                cellData = "N/A";
              }

              if (typeof cellData === "string") {
                cellData = cellData.replace(/"/g, '""');
                if (
                  cellData.includes(",") ||
                  cellData.includes('"') ||
                  cellData.includes("\n")
                ) {
                  cellData = `"${cellData}"`;
                }
              }

              return cellData;
            })
            .join(",");
        })
        .join("\n");

      const csvContent = `${headers}\n${rows}`;

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      const fileName = `survey-data-export-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error exporting data:", err);
      alert("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    const completes = filteredData.filter(
      (item) => item.status && item.status.toLowerCase() === "complete"
    ).length;

    const totalResponses = filteredData.filter((item) => {
      const status = (item.status || "").toLowerCase();
      return [
        "complete",
        "terminate",
        "quotafull",
        "quality",
        "dquality",
      ].includes(status);
    }).length;

    const conversionRate =
      totalResponses > 0
        ? ((completes / totalResponses) * 100).toFixed(1)
        : "0.0";

    return {
      completes,
      conversionRate,
    };
  }, [filteredData]);

  // Status chart data
  const statusChartData = useMemo(() => {
    const statusCounts = {};

    filteredData.forEach((item) => {
      const status = item.status || "NULL";
      if (statusCounts[status]) {
        statusCounts[status]++;
      } else {
        statusCounts[status] = 1;
      }
    });

    return Object.keys(statusCounts).map((status) => ({
      name: status,
      value: statusCounts[status],
    }));
  }, [filteredData]);

  // Routed Count chart data with completion stats
  const routedChartData = useMemo(() => {
    const routedCounts = {
      "No Routes": { total: 0, completed: 0 },
      "1 Route": { total: 0, completed: 0 },
      "2-3 Routes": { total: 0, completed: 0 },
      "4-5 Routes": { total: 0, completed: 0 },
      "6+ Routes": { total: 0, completed: 0 },
    };

    filteredData.forEach((item) => {
      const count = item.routed_count || 0;
      const isCompleted =
        item.status && item.status.toLowerCase() === "complete";

      if (count === 0) {
        routedCounts["No Routes"].total++;
        if (isCompleted) routedCounts["No Routes"].completed++;
      } else if (count === 1) {
        routedCounts["1 Route"].total++;
        if (isCompleted) routedCounts["1 Route"].completed++;
      } else if (count <= 3) {
        routedCounts["2-3 Routes"].total++;
        if (isCompleted) routedCounts["2-3 Routes"].completed++;
      } else if (count <= 5) {
        routedCounts["4-5 Routes"].total++;
        if (isCompleted) routedCounts["4-5 Routes"].completed++;
      } else {
        routedCounts["6+ Routes"].total++;
        if (isCompleted) routedCounts["6+ Routes"].completed++;
      }
    });

    return Object.entries(routedCounts)
      .filter(([, values]) => values.total > 0) // Only include groups with data
      .map(([name, values]) => ({
        name,
        value: values.total,
        completed: values.completed,
      }));
  }, [filteredData]);

  // Get unique survey providers for dropdown
  const uniqueSurveyProviders = useMemo(() => {
    const providers = [
      ...new Set(data.map((item) => item.surveyProviders).filter(Boolean)),
    ];
    return providers.sort();
  }, [data]);

  const STATUS_COLORS = {
    complete: "#10b981",
    terminate: "#ef4444",
    quotafull: "#f59e0b",
    quality: "#6366f1",
    dquality: "#9333ea",
    NULL: "#9ca3af",
    default: "#6b7280",
  };

  const currentItems = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return filteredData.slice(indexOfFirstItem, indexOfLastItem);
  }, [filteredData, currentPage, itemsPerPage]);

  const clearDateFilter = () => {
    setDateRange({ from: "", to: "" });
  };

  const clearAllFilters = () => {
    setDateRange({ from: "", to: "" });
    setSourceFilter("");
    setColumnFilters({
      id: "",
      SessionID: "",
      SupplyID: "",
      SurveyID: "",
      UserID: "",
      status: "",
      original_cpi: "",
      desired_cpi: "",
      dtectScore: "",
      country_language: "",
      ClientStatus: "",
      InitialStatus: "",
      surveyProviders: "",
      IPAddress: "",
      createdAt: "",
      updatedAt: "",
    });
  };

  const getDisplayStatus = (item) => {
    if (item.dtectScore === "bad" && (!item.status || item.status === "NULL")) {
      return "dquality";
    }
    return item.status || "NULL";
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "200px",
        }}
      >
        <div>Loading data...</div>
      </div>
    );
  }

  if (showError) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px",
        }}
      >
        <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
        <button
          onClick={() => {
            setShowError(false);
            window.location.reload();
          }}
          style={{
            padding: "10px 20px",
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const columns = [
    "id",
    "SessionID",
    "SupplyID",
    "SurveyID",
    "UserID",
    "status",
    "original_cpi",
    "desired_cpi",
    "dtectScore",
    "country_language",
    "ClientStatus",
    "InitialStatus",
    "surveyProviders",
    "IPAddress",
    "routed_count",
    "createdAt",
    "updatedAt",
  ];

  const getStatusBadge = (status) => {
    const colors = {
      terminate: "#ef4444",
      complete: "#10b981",
      quotafull: "#f59e0b",
      quality: "#6366f1",
      dquality: "#9333ea",
    };
    return {
      backgroundColor: colors[status] || "#6b7280",
      color: "white",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "12px",
      fontWeight: "500",
    };
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    return STATUS_COLORS[status] || STATUS_COLORS.default;
  };

  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    percent,
    name,
  }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius * 1.1;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="#000000"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize="12"
      >
        {`${name} (${(percent * 100).toFixed(0)}%)`}
      </text>
    );
  };

  const renderPagination = () => {
    let pagesToShow = [];
    if (totalPages <= 7) {
      pagesToShow = pageNumbers;
    } else {
      if (currentPage <= 4) {
        pagesToShow = [1, 2, 3, 4, 5, "...", totalPages];
      } else if (currentPage > totalPages - 4) {
        pagesToShow = [
          1,
          "...",
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        ];
      } else {
        pagesToShow = [
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages,
        ];
      }
    }

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginTop: "20px",
        }}
      >
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: "8px 16px",
            backgroundColor: currentPage === 1 ? "#e5e7eb" : "#3b82f6",
            color: currentPage === 1 ? "#9ca3af" : "white",
            border: "none",
            borderRadius: "5px",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
          }}
        >
          Previous
        </button>

        {pagesToShow.map((page, index) =>
          page === "..." ? (
            <span key={`ellipsis-${index}`} style={{ padding: "8px" }}>
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              style={{
                padding: "8px 12px",
                backgroundColor: currentPage === page ? "#3b82f6" : "#f3f4f6",
                color: currentPage === page ? "white" : "#374151",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: "8px 16px",
            backgroundColor: currentPage === totalPages ? "#e5e7eb" : "#3b82f6",
            color: currentPage === totalPages ? "#9ca3af" : "white",
            border: "none",
            borderRadius: "5px",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
          }}
        >
          Next
        </button>

        <div
          style={{
            marginLeft: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>Items per page:</span>
          <select
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
            style={{
              padding: "5px",
              borderRadius: "5px",
              border: "1px solid #d1d5db",
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
    );
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.value / filteredData.length) * 100).toFixed(1);
      const completionRate =
        data.completed > 0
          ? ((data.completed / data.value) * 100).toFixed(1)
          : 0;

      return (
        <div
          style={{
            backgroundColor: "white",
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <p style={{ margin: 0, fontWeight: "bold" }}>{data.name}</p>
          <p style={{ margin: 0 }}>{`Total: ${data.value} (${percentage}%)`}</p>
          <p
            style={{ margin: 0 }}
          >{`Completed: ${data.completed} (${completionRate}%)`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      {/* Metrics Dashboard */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <div
          style={{
            backgroundColor: "#f8f9fa",
            padding: "20px",
            borderRadius: "8px",
            flex: 1,
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: "14px", color: "#6b7280", marginBottom: "5px" }}
          >
            Total Completes
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "bold", color: "#10b981" }}
          >
            {metrics.completes}
          </div>
          <div style={{ fontSize: "12px", color: "#9ca3af" }}>
            From filtered results
          </div>
        </div>
        <div
          style={{
            backgroundColor: "#f8f9fa",
            padding: "20px",
            borderRadius: "8px",
            flex: 1,
            textAlign: "center",
          }}
        >
          <div
            style={{ fontSize: "14px", color: "#6b7280", marginBottom: "5px" }}
          >
            Conversion Rate
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "bold", color: "#3b82f6" }}
          >
            {metrics.conversionRate}%
          </div>
          <div style={{ fontSize: "12px", color: "#9ca3af" }}>
            Completes / Total responses
          </div>
        </div>
      </div>

      {/* Total Results */}
      <div style={{ marginBottom: "20px", textAlign: "center" }}>
        <span
          style={{ fontSize: "24px", fontWeight: "bold", color: "#374151" }}
        >
          {filteredData.length}
        </span>
        <span
          style={{ fontSize: "16px", color: "#6b7280", marginLeft: "10px" }}
        >
          Total Results
        </span>
      </div>

      {/* Enhanced Controls */}
      <div style={{ marginBottom: "20px" }}>
        {/* First row - Date Range and Source Filter */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            marginBottom: "15px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span>Date Range:</span>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => handleDateRangeChange("from", e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #d1d5db",
              }}
            />
            <span>to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => handleDateRangeChange("to", e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #d1d5db",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span>Survey Provider:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "5px",
                border: "1px solid #d1d5db",
                minWidth: "120px",
              }}
            >
              <option value="">All Providers</option>
              {uniqueSurveyProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second row - Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={clearDateFilter}
            style={{
              padding: "8px 16px",
              backgroundColor: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Clear Date Filter
          </button>

          <button
            onClick={clearAllFilters}
            style={{
              padding: "8px 16px",
              backgroundColor: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Clear All Filters
          </button>

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>

          <button
            onClick={exportToExcel}
            disabled={isExporting || filteredData.length === 0}
            style={{
              padding: "8px 16px",
              backgroundColor: isExporting ? "#9ca3af" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: isExporting ? "not-allowed" : "pointer",
            }}
          >
            {isExporting ? "Exporting..." : "Export to CSV"}
          </button>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        {/* Status Chart */}
        <div
          style={{
            backgroundColor: "#f8f9fa",
            padding: "20px",
            borderRadius: "8px",
            flex: "1",
          }}
        >
          <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
            Status Distribution
          </h3>
          <div style={{ height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  nameKey="name"
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={renderCustomizedLabel}
                  labelLine={({ percent }) => percent >= 0.05}
                >
                  {statusChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getStatusColor(entry.name)}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Routed Count Chart */}
        <div
          style={{
            backgroundColor: "#f8f9fa",
            padding: "20px",
            borderRadius: "8px",
            flex: "1",
          }}
        >
          <h3 style={{ textAlign: "center", marginBottom: "20px" }}>
            Route Distribution
          </h3>
          <div style={{ height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={routedChartData}
                  nameKey="name"
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label={renderCustomizedLabel}
                  labelLine={({ percent }) => percent >= 0.05}
                >
                  {routedChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        [
                          "#10b981", // Green
                          "#3b82f6", // Blue
                          "#f59e0b", // Orange
                          "#8b5cf6", // Purple
                          "#ef4444", // Red
                        ][index % 5]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table with Column Filters */}
      <div
        style={{
          overflowX: "auto",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            {/* Header Row */}
            <tr style={{ backgroundColor: "#f3f4f6" }}>
              {columns.map((column) => (
                <th
                  key={column}
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    borderBottom: "1px solid #e5e7eb",
                    fontWeight: "600",
                  }}
                >
                  <div
                    onClick={() => handleSort(column)}
                    style={{
                      cursor:
                        column === "createdAt" || column === "updatedAt"
                          ? "pointer"
                          : "default",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    {column}
                    {(column === "createdAt" || column === "updatedAt") &&
                      sortConfig.key === column && (
                        <span>
                          {sortConfig.direction === "ascending" ? " ▲" : " ▼"}
                        </span>
                      )}
                  </div>
                </th>
              ))}
            </tr>
            {/* Filter Row */}
            <tr style={{ backgroundColor: "#f9fafb" }}>
              {columns.map((column) => (
                <th
                  key={`filter-${column}`}
                  style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}
                >
                  <input
                    type="text"
                    placeholder={`Filter ${column}...`}
                    value={columnFilters[column]}
                    onChange={(e) =>
                      handleColumnFilterChange(column, e.target.value)
                    }
                    style={{
                      width: "100%",
                      padding: "6px",
                      borderRadius: "4px",
                      border: "1px solid #d1d5db",
                      fontSize: "12px",
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentItems.length > 0 ? (
              currentItems.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  style={{
                    backgroundColor: rowIndex % 2 === 0 ? "#ffffff" : "#f9fafb",
                  }}
                >
                  {columns.map((column) => {
                    if (column === "status") {
                      const displayStatus = getDisplayStatus(row);
                      return (
                        <td
                          key={column}
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          <span style={getStatusBadge(displayStatus)}>
                            {displayStatus}
                          </span>
                        </td>
                      );
                    } else if (
                      column === "createdAt" ||
                      column === "updatedAt"
                    ) {
                      return (
                        <td
                          key={column}
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {row[column] ? formatDate(row[column]) : "N/A"}
                        </td>
                      );
                    } else if (
                      column === "original_cpi" ||
                      column === "desired_cpi"
                    ) {
                      return (
                        <td
                          key={column}
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {row[column] ? `$${row[column]}` : "N/A"}
                        </td>
                      );
                    } else if (column === "dtectScore") {
                      return (
                        <td
                          key={column}
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          <span
                            style={{
                              backgroundColor:
                                row[column] === "good"
                                  ? "#10b981"
                                  : row[column] === "bad"
                                  ? "#ef4444"
                                  : "#6b7280",
                              color: "white",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: "500",
                            }}
                          >
                            {row[column] || "N/A"}
                          </span>
                        </td>
                      );
                    } else {
                      return (
                        <td
                          key={column}
                          style={{
                            padding: "12px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {row[column] || "N/A"}
                        </td>
                      );
                    }
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#6b7280",
                  }}
                >
                  No data found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {renderPagination()}

      {/* Results Info */}
      <div style={{ marginTop: "10px", color: "#6b7280", fontSize: "14px" }}>
        Showing{" "}
        {currentItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{" "}
        {Math.min(currentPage * itemsPerPage, filteredData.length)} of{" "}
        {filteredData.length} results
        {filteredData.length !== data.length &&
          ` (filtered from ${data.length} total)`}
      </div>
    </div>
  );
}
