import { useState, useEffect, useRef, useCallback } from "react";
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

/**
 * AI Session status type
 */
type SessionStatus = "idle" | "ready" | "querying" | "error";

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
 * AI Analysis Page
 * Enables natural language queries over transaction data
 */
export default function AIAnalysisPage() {
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");

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

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
      setSessionStatus("ready");
      setMessages([
        {
          role: "assistant",
          content: `Phiên phân tích đã sẵn sàng. AI sẽ truy vấn trực tiếp vào cơ sở dữ liệu. Bạn có thể đặt câu hỏi về dữ liệu xuất khẩu.`,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
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

      // Add typing indicator
      const typingMessage: Message = {
        role: "assistant",
        content: "typing",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, typingMessage]);

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

      // Remove typing indicator and add assistant response
      setMessages((prev) => {
        const withoutTyping = prev.filter((msg) => msg.content !== "typing");
        return [
          ...withoutTyping,
          {
            role: "assistant",
            content: data.answer,
            citations: data.citations,
            confidence: data.confidence,
            timestamp: new Date(),
          },
        ];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send question");
      // Remove typing indicator on error
      setMessages((prev) => prev.filter((msg) => msg.content !== "typing"));
    } finally {
      setIsQuerying(false);
    }
  };

  /**
   * Reset session
   */
  const resetSession = async () => {
    setSessionId(null);
    setSessionStatus("idle");
    setMessages([]);
    setError(null);
    await createSession();
  };

  // Create initial session on mount
  useEffect(() => {
    createSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Get status color
   */
  const getStatusColor = () => {
    switch (sessionStatus) {
      case "idle":
        return "default";
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
        return "Đang khởi tạo...";
      case "ready":
        return "Sẵn sàng";
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

      {/* Status Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Chip
              label={getStatusText()}
              color={getStatusColor()}
              icon={<InfoIcon />}
            />
            {sessionStatus === "ready" && (
              <Typography variant="body2" color="text.secondary">
                AI sẽ truy vấn trực tiếp vào cơ sở dữ liệu
              </Typography>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <IconButton
              size="small"
              onClick={resetSession}
              title="Tạo phiên mới"
            >
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Suggested Queries */}
      {sessionStatus === "ready" && suggestedQueries.length > 0 && messages.length === 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Câu hỏi gợi ý:
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {suggestedQueries.map((query, index) => (
              <Button
                key={index}
                variant="outlined"
                size="small"
                onClick={() => sendQuestion(query)}
                disabled={isQuerying}
              >
                {query}
              </Button>
            ))}
          </Box>
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Chat Interface */}
        <Grid item xs={12}>
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
                          {message.content === "typing" ? (
                            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  bgcolor: "grey.500",
                                  animation: "bounce 1.4s infinite ease-in-out",
                                  animationDelay: "0s",
                                  "@keyframes bounce": {
                                    "0%, 80%, 100%": { transform: "scale(0)" },
                                    "40%": { transform: "scale(1)" },
                                  },
                                }}
                              />
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  bgcolor: "grey.500",
                                  animation: "bounce 1.4s infinite ease-in-out",
                                  animationDelay: "0.2s",
                                  "@keyframes bounce": {
                                    "0%, 80%, 100%": { transform: "scale(0)" },
                                    "40%": { transform: "scale(1)" },
                                  },
                                }}
                              />
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  bgcolor: "grey.500",
                                  animation: "bounce 1.4s infinite ease-in-out",
                                  animationDelay: "0.4s",
                                  "@keyframes bounce": {
                                    "0%, 80%, 100%": { transform: "scale(0)" },
                                    "40%": { transform: "scale(1)" },
                                  },
                                }}
                              />
                            </Box>
                          ) : (
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
                          )}
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
