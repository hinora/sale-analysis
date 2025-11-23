import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  List,
  ListItem,
  IconButton,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import {
  Send as SendIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import CategorySelect from "@/components/common/CategorySelect";

/**
 * AI Session status type
 */
type SessionStatus = "idle" | "feeding" | "ready" | "querying" | "error";

/**
 * Message in conversation
 */
interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  confidence?: "high" | "medium" | "low";
  timestamp: Date;
}

/**
 * Data filters for transaction selection
 */
interface DataFilters {
  category: string;
  dateFrom: string;
  dateTo: string;
  company: string;
}

/**
 * AI Analysis Page
 * Enables natural language queries over transaction data
 */
export default function AIAnalysisPage() {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [transactionCount, setTransactionCount] = useState(0);

  // Filters for data selection
  const [filters, setFilters] = useState<DataFilters>({
    category: "",
    dateFrom: "",
    dateTo: "",
    company: "",
  });

  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [suggestedQueries] = useState([
    "Công ty nào nhập khẩu nhiều nhất?",
    "Tổng giá trị xuất khẩu là bao nhiêu?",
    "Mặt hàng nào có giá trị cao nhất?",
    "So sánh giá trị giữa các danh mục hàng hóa",
    "Xu hướng nhập khẩu theo thời gian thế nào?",
  ]);

  // Auto-scroll to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * Create a new AI session
   */
  const createSession = async () => {
    try {
      setError(null);
      const response = await fetch("/api/ai/session", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create session");
      }

      setSessionId(data.sessionId);
      setSessionStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    }
  };

  /**
   * Feed data to AI session
   */
  const feedData = async () => {
    if (!sessionId) {
      await createSession();
      return;
    }

    try {
      setError(null);
      setSessionStatus("feeding");

      const response = await fetch("/api/ai/feed-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          filters: {
            ...(filters.category && { category: filters.category }),
            ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
            ...(filters.dateTo && { dateTo: filters.dateTo }),
            ...(filters.company && { company: filters.company }),
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to feed data");
      }

      setTransactionCount(data.transactionCount);
      setSessionStatus("ready");
      setMessages([
        {
          role: "assistant",
          content: `Đã tải ${data.transactionCount} giao dịch vào phiên phân tích. Bạn có thể đặt câu hỏi về dữ liệu này.`,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to feed data");
      setSessionStatus("error");
    }
  };

  /**
   * Send a question to AI
   */
  const sendQuestion = async (question?: string) => {
    const queryText = question || currentQuestion;

    if (!queryText.trim()) {
      return;
    }

    if (!sessionId || sessionStatus !== "ready") {
      setError("Please feed data first before asking questions");
      return;
    }

    try {
      setError(null);
      setIsQuerying(true);

      // Add user message immediately
      const userMessage: Message = {
        role: "user",
        content: queryText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setCurrentQuestion("");

      // Send query to API
      const response = await fetch("/api/ai/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          question: queryText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to process query");
      }

      // Add assistant response
      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
        citations: data.citations,
        confidence: data.confidence,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send question");
    } finally {
      setIsQuerying(false);
    }
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (key: keyof DataFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Reset session
   */
  const resetSession = async () => {
    setSessionId(null);
    setSessionStatus("idle");
    setMessages([]);
    setTransactionCount(0);
    setError(null);
    await createSession();
  };

  // Create initial session on mount
  useEffect(() => {
    createSession();
  }, []);

  /**
   * Get status color
   */
  const getStatusColor = () => {
    switch (sessionStatus) {
      case "idle":
        return "default";
      case "feeding":
        return "warning";
      case "ready":
        return "success";
      case "querying":
        return "info";
      case "error":
        return "error";
      default:
        return "default";
    }
  };

  /**
   * Get status text
   */
  const getStatusText = () => {
    switch (sessionStatus) {
      case "idle":
        return "Chọn dữ liệu và nhấn 'Tải dữ liệu vào AI'";
      case "feeding":
        return "Đang tải dữ liệu...";
      case "ready":
        return `Sẵn sàng (${transactionCount} giao dịch)`;
      case "querying":
        return "Đang xử lý câu hỏi...";
      case "error":
        return "Có lỗi xảy ra";
      default:
        return "Không xác định";
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader
        title="Phân tích AI"
        subtitle="Đặt câu hỏi bằng ngôn ngữ tự nhiên về dữ liệu xuất khẩu"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Panel: Data Selection */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              1. Chọn dữ liệu
            </Typography>

            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2 }}
            >
              <CategorySelect
                value={filters.category}
                onChange={(value) => handleFilterChange("category", value)}
                label="Danh mục (tùy chọn)"
              />

              <TextField
                label="Từ ngày"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                fullWidth
              />

              <TextField
                label="Đến ngày"
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
                fullWidth
              />

              <TextField
                label="Công ty (tùy chọn)"
                value={filters.company}
                onChange={(e) => handleFilterChange("company", e.target.value)}
                size="small"
                fullWidth
                placeholder="Nhập tên công ty"
              />

              <Button
                variant="contained"
                onClick={feedData}
                disabled={sessionStatus === "feeding"}
                startIcon={
                  sessionStatus === "feeding" ? (
                    <CircularProgress size={20} />
                  ) : undefined
                }
                fullWidth
              >
                {sessionStatus === "feeding"
                  ? "Đang tải..."
                  : "Tải dữ liệu vào AI"}
              </Button>

              <Divider />

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Chip
                  label={getStatusText()}
                  color={getStatusColor()}
                  size="small"
                  icon={<InfoIcon />}
                />
                <IconButton
                  size="small"
                  onClick={resetSession}
                  title="Tạo phiên mới"
                >
                  <RefreshIcon />
                </IconButton>
              </Box>
            </Box>

            {sessionStatus === "ready" && suggestedQueries.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Câu hỏi gợi ý:
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {suggestedQueries.map((query, index) => (
                    <Button
                      key={index}
                      variant="outlined"
                      size="small"
                      onClick={() => sendQuestion(query)}
                      disabled={isQuerying}
                      sx={{ justifyContent: "flex-start", textAlign: "left" }}
                    >
                      {query}
                    </Button>
                  ))}
                </Box>
              </>
            )}
          </Paper>

          {transactionCount > 10000 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Giới hạn 10,000 giao dịch. Vui lòng thu hẹp bộ lọc để có kết quả
              chính xác hơn.
            </Alert>
          )}
        </Grid>

        {/* Right Panel: Chat Interface */}
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              p: 3,
              height: "70vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="h6" gutterBottom>
              2. Hỏi và nhận câu trả lời
            </Typography>

            {/* Messages List */}
            <Box
              sx={{
                flexGrow: 1,
                overflowY: "auto",
                mb: 2,
                p: 2,
                bgcolor: "grey.50",
                borderRadius: 1,
              }}
            >
              {messages.length === 0 ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                  }}
                >
                  <Typography color="text.secondary">
                    {sessionStatus === "ready"
                      ? "Bắt đầu bằng cách đặt câu hỏi hoặc chọn câu hỏi gợi ý"
                      : "Hãy chọn dữ liệu và tải vào AI để bắt đầu"}
                  </Typography>
                </Box>
              ) : (
                <List>
                  {messages.map((message, index) => (
                    <ListItem
                      key={index}
                      sx={{
                        flexDirection: "column",
                        alignItems:
                          message.role === "user" ? "flex-end" : "flex-start",
                        mb: 2,
                      }}
                    >
                      <Card
                        sx={{
                          maxWidth: "80%",
                          bgcolor:
                            message.role === "user" ? "primary.light" : "white",
                        }}
                      >
                        <CardContent>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            gutterBottom
                          >
                            {message.role === "user" ? "Bạn" : "AI"}
                            {message.confidence && (
                              <Chip
                                label={message.confidence}
                                size="small"
                                sx={{ ml: 1 }}
                                color={
                                  message.confidence === "high"
                                    ? "success"
                                    : message.confidence === "low"
                                      ? "error"
                                      : "default"
                                }
                              />
                            )}
                          </Typography>
                          <Box
                            sx={{
                              "& p": { mb: 1 },
                              "& ul, & ol": { pl: 2, mb: 1 },
                              "& li": { mb: 0.5 },
                              "& code": {
                                bgcolor: "grey.100",
                                px: 0.5,
                                py: 0.25,
                                borderRadius: 0.5,
                                fontFamily: "monospace",
                                fontSize: "0.9em",
                              },
                              "& pre": {
                                bgcolor: "grey.100",
                                p: 1,
                                borderRadius: 1,
                                overflow: "auto",
                              },
                              "& table": {
                                borderCollapse: "collapse",
                                width: "100%",
                                mb: 1,
                              },
                              "& th, & td": {
                                border: "1px solid",
                                borderColor: "grey.300",
                                p: 1,
                                textAlign: "left",
                              },
                              "& th": {
                                bgcolor: "grey.100",
                                fontWeight: "bold",
                              },
                            }}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </Box>
                          {message.citations &&
                            message.citations.length > 0 && (
                              <Box sx={{ mt: 1 }}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  Trích dẫn:{" "}
                                  {message.citations.map((citation, i) => (
                                    <Chip
                                      key={i}
                                      label={citation}
                                      size="small"
                                      sx={{ mr: 0.5, mt: 0.5 }}
                                    />
                                  ))}
                                </Typography>
                              </Box>
                            )}
                        </CardContent>
                      </Card>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.5 }}
                      >
                        {message.timestamp.toLocaleTimeString("vi-VN")}
                      </Typography>
                    </ListItem>
                  ))}
                  <div ref={messagesEndRef} />
                </List>
              )}
            </Box>

            {/* Input Box */}
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                fullWidth
                placeholder="Đặt câu hỏi về dữ liệu..."
                value={currentQuestion}
                onChange={(e) => setCurrentQuestion(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendQuestion();
                  }
                }}
                disabled={sessionStatus !== "ready" || isQuerying}
                multiline
                maxRows={3}
                size="small"
              />
              <Button
                variant="contained"
                onClick={() => sendQuestion()}
                disabled={
                  sessionStatus !== "ready" ||
                  isQuerying ||
                  !currentQuestion.trim()
                }
                startIcon={
                  isQuerying ? <CircularProgress size={20} /> : <SendIcon />
                }
              >
                Gửi
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
