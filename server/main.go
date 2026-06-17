package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type PatientStatus string

const (
	StatusWaiting    PatientStatus = "waiting"
	StatusVisiting   PatientStatus = "visiting"
	StatusCompleted  PatientStatus = "completed"
	StatusMissed     PatientStatus = "missed"
	StatusPreRegistered PatientStatus = "preregistered"
)

type Patient struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	Name            string         `gorm:"not null" json:"name"`
	PhoneLast4      string         `gorm:"size:4" json:"phoneLast4"`
	Department      string         `gorm:"not null;index" json:"department"`
	AppointmentTime *time.Time     `json:"appointmentTime,omitempty"`
	QueueNumber     int            `gorm:"index" json:"queueNumber"`
	Status          PatientStatus  `gorm:"not null;index" json:"status"`
	Priority        bool           `gorm:"default:false" json:"priority"`
	MissedCount     int            `gorm:"default:0" json:"missedCount"`
	CheckInTime     *time.Time     `json:"checkInTime,omitempty"`
	VisitStartTime  *time.Time     `json:"visitStartTime,omitempty"`
	VisitEndTime    *time.Time     `json:"visitEndTime,omitempty"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
}

type Department struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	Name           string    `gorm:"not null;uniqueIndex" json:"name"`
	CurrentCall    int       `gorm:"default:0" json:"currentCall"`
	DoctorOnDuty   bool      `gorm:"default:true" json:"doctorOnDuty"`
	AvgVisitDuration int     `gorm:"default:900" json:"avgVisitDuration"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type WSClient struct {
	Conn   *websocket.Conn
	Role   string
	RoomID string
	Send   chan []byte
}

var (
	db   *gorm.DB
	hub  *Hub
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
)

func maskName(name string) string {
	if len(name) <= 1 {
		return name
	}
	runes := []rune(name)
	if len(runes) == 2 {
		return string(runes[0]) + "*"
	}
	result := make([]rune, len(runes))
	result[0] = runes[0]
	for i := 1; i < len(runes)-1; i++ {
		result[i] = '*'
	}
	result[len(runes)-1] = runes[len(runes)-1]
	return string(result)
}

func initDB() {
	var err error
	db, err = gorm.Open(sqlite.Open("clinic.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	err = db.AutoMigrate(&Patient{}, &Department{})
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	departments := []string{"内科", "外科", "儿科", "妇产科", "口腔科"}
	for _, name := range departments {
		var count int64
		db.Model(&Department{}).Where("name = ?", name).Count(&count)
		if count == 0 {
			db.Create(&Department{Name: name})
		}
	}
}

func updateAvgVisitDuration(deptName string) {
	var patients []Patient
	db.Where("department = ? AND status = ? AND visit_start_time IS NOT NULL AND visit_end_time IS NOT NULL",
		deptName, StatusCompleted).
		Order("visit_end_time DESC").
		Limit(50).
		Find(&patients)

	if len(patients) == 0 {
		return
	}

	var totalDuration int64
	for _, p := range patients {
		if p.VisitStartTime != nil && p.VisitEndTime != nil {
			totalDuration += int64(p.VisitEndTime.Sub(*p.VisitStartTime).Seconds())
		}
	}
	avg := int(totalDuration / int64(len(patients)))

	db.Model(&Department{}).Where("name = ?", deptName).Update("avg_visit_duration", avg)
}

func getEstimatedWaitTime(deptName string, position int) int {
	var dept Department
	db.Where("name = ?", deptName).First(&dept)
	return dept.AvgVisitDuration * position
}

func getQueueWithEstimates(deptName string) ([]map[string]interface{}, error) {
	var patients []Patient
	err := db.Where("department = ? AND status = ?", deptName, StatusWaiting).
		Order("priority DESC, queue_number ASC").
		Find(&patients).Error
	if err != nil {
		return nil, err
	}

	var dept Department
	db.Where("name = ?", deptName).First(&dept)

	result := make([]map[string]interface{}, len(patients))
	for i, p := range patients {
		estimatedWait := dept.AvgVisitDuration * i
		var waitDuration int
		if p.CheckInTime != nil {
			waitDuration = int(time.Since(*p.CheckInTime).Seconds())
		}
		result[i] = map[string]interface{}{
			"id":              p.ID,
			"name":            maskName(p.Name),
			"phoneLast4":      p.PhoneLast4,
			"department":      p.Department,
			"queueNumber":     p.QueueNumber,
			"status":          p.Status,
			"priority":        p.Priority,
			"missedCount":     p.MissedCount,
			"checkInTime":     p.CheckInTime,
			"waitDuration":    waitDuration,
			"estimatedWait":   estimatedWait,
			"estimatedWaitWarn": estimatedWait > 900,
		}
	}
	return result, nil
}

func handleWebSocket(c *gin.Context) {
	role := c.Query("role")
	roomID := c.Query("roomId")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		return
	}

	client := &WSClient{
		Conn:   conn,
		Role:   role,
		RoomID: roomID,
		Send:   make(chan []byte, 256),
	}

	hub.register <- client

	go client.writePump()
	go client.readPump()
}

func (c *WSClient) readPump() {
	defer func() {
		hub.unregister <- c
		c.Conn.Close()
	}()

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
	}
}

func (c *WSClient) writePump() {
	defer func() {
		c.Conn.Close()
	}()

	for message := range c.Send {
		c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
			return
		}
	}
	c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
}

func createPatient(c *gin.Context) {
	var req struct {
		Name            string     `json:"name" binding:"required"`
		PhoneLast4      string     `json:"phoneLast4"`
		Department      string     `json:"department" binding:"required"`
		AppointmentTime *time.Time `json:"appointmentTime"`
		Priority        bool       `json:"priority"`
		PreRegistered   bool       `json:"preRegistered"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var dept Department
	if err := db.Where("name = ?", req.Department).First(&dept).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "科室不存在"})
		return
	}

	tx := db.Begin()

	var maxQueueNum int
	tx.Model(&Patient{}).
		Where("department = ? AND DATE(created_at) = DATE('now')", req.Department).
		Select("COALESCE(MAX(queue_number), 0)").
		Scan(&maxQueueNum)

	status := StatusWaiting
	now := time.Now()
	checkInTime := &now
	if req.PreRegistered {
		status = StatusPreRegistered
		checkInTime = nil
	}

	patient := Patient{
		Name:            req.Name,
		PhoneLast4:      req.PhoneLast4,
		Department:      req.Department,
		AppointmentTime: req.AppointmentTime,
		QueueNumber:     maxQueueNum + 1,
		Status:          status,
		Priority:        req.Priority,
		CheckInTime:     checkInTime,
	}

	if err := tx.Create(&patient).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tx.Commit()

	c.JSON(http.StatusCreated, gin.H{
		"id":          patient.ID,
		"queueNumber": patient.QueueNumber,
		"name":        maskName(patient.Name),
		"status":      patient.Status,
	})

	if status == StatusWaiting {
		broadcastQueueUpdate(req.Department)
	}
}

func activatePatient(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	tx := db.Begin()

	var patient Patient
	if err := tx.First(&patient, uint(id)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "患者不存在"})
		return
	}

	if patient.Status != StatusPreRegistered {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "只有预约患者可以激活"})
		return
	}

	now := time.Now()
	patient.Status = StatusWaiting
	patient.CheckInTime = &now

	if err := tx.Save(&patient).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, patient)
	broadcastQueueUpdate(patient.Department)
}

func callNext(c *gin.Context) {
	var req struct {
		Department string `json:"department" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := db.Begin()

	var currentVisiting Patient
	result := tx.Where("department = ? AND status = ?", req.Department, StatusVisiting).First(&currentVisiting)
	if result.Error == nil {
		now := time.Now()
		currentVisiting.Status = StatusCompleted
		currentVisiting.VisitEndTime = &now
		if err := tx.Save(&currentVisiting).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "更新当前患者状态失败"})
			return
		}
	}

	var nextPatient Patient
	err := tx.Where("department = ? AND status = ?", req.Department, StatusWaiting).
		Order("priority DESC, queue_number ASC").
		First(&nextPatient).Error

	if err != nil {
		tx.Commit()
		c.JSON(http.StatusOK, gin.H{"message": "没有等待的患者", "nextPatient": nil})
		return
	}

	now := time.Now()
	nextPatient.Status = StatusVisiting
	nextPatient.VisitStartTime = &now
	if err := tx.Save(&nextPatient).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新下一位患者状态失败"})
		return
	}

	var dept Department
	if err := tx.Where("name = ?", req.Department).First(&dept).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "科室不存在"})
		return
	}

	dept.CurrentCall = nextPatient.QueueNumber
	if err := tx.Save(&dept).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新科室叫号失败"})
		return
	}

	tx.Commit()

	go updateAvgVisitDuration(req.Department)

	response := gin.H{
		"message": "叫号成功",
		"nextPatient": gin.H{
			"id":          nextPatient.ID,
			"name":        maskName(nextPatient.Name),
			"queueNumber": nextPatient.QueueNumber,
			"department":  nextPatient.Department,
		},
		"currentCall": dept.CurrentCall,
	}

	c.JSON(http.StatusOK, response)
	broadcastCallNext(req.Department, nextPatient)
}

func markMissed(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	tx := db.Begin()

	var patient Patient
	if err := tx.First(&patient, uint(id)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "患者不存在"})
		return
	}

	patient.Status = StatusMissed
	patient.MissedCount += 1

	if err := tx.Save(&patient).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, patient)
	broadcastQueueUpdate(patient.Department)
}

func requeuePatient(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	tx := db.Begin()

	var patient Patient
	if err := tx.First(&patient, uint(id)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "患者不存在"})
		return
	}

	patient.Status = StatusWaiting
	patient.Priority = true
	now := time.Now()
	patient.CheckInTime = &now

	if err := tx.Save(&patient).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, patient)
	broadcastQueueUpdate(patient.Department)
}

func prioritizePatient(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	tx := db.Begin()

	var patient Patient
	if err := tx.First(&patient, uint(id)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "患者不存在"})
		return
	}

	patient.Priority = true

	if err := tx.Save(&patient).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, patient)
	broadcastQueueUpdate(patient.Department)
}

func getQueue(c *gin.Context) {
	dept := c.Query("department")
	if dept == "" {
		var patients []Patient
		db.Where("status IN ?", []PatientStatus{StatusWaiting, StatusVisiting}).
			Order("department, priority DESC, queue_number ASC").
			Find(&patients)
		c.JSON(http.StatusOK, patients)
		return
	}

	queue, err := getQueueWithEstimates(dept)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, queue)
}

func getCompleted(c *gin.Context) {
	var patients []Patient
	db.Where("status IN ?", []PatientStatus{StatusCompleted, StatusMissed}).
		Order("updated_at DESC").
		Limit(30).
		Find(&patients)
	c.JSON(http.StatusOK, patients)
}

func getDepartments(c *gin.Context) {
	var departments []Department
	db.Find(&departments)

	result := make([]map[string]interface{}, len(departments))
	for i, d := range departments {
		var waitingCount int64
		db.Model(&Patient{}).Where("department = ? AND status = ?", d.Name, StatusWaiting).Count(&waitingCount)

		var visiting Patient
		visitingData := map[string]interface{}{}
		if err := db.Where("department = ? AND status = ?", d.Name, StatusVisiting).First(&visiting).Error; err == nil {
			visitingData = map[string]interface{}{
				"id":          visiting.ID,
				"name":        maskName(visiting.Name),
				"queueNumber": visiting.QueueNumber,
			}
		}

		result[i] = map[string]interface{}{
			"id":               d.ID,
			"name":             d.Name,
			"currentCall":      d.CurrentCall,
			"doctorOnDuty":     d.DoctorOnDuty,
			"avgVisitDuration": d.AvgVisitDuration,
			"waitingCount":     waitingCount,
			"estimatedWait":    d.AvgVisitDuration * int(waitingCount),
			"visiting":         visitingData,
		}
	}

	c.JSON(http.StatusOK, result)
}

func getPreRegistered(c *gin.Context) {
	var patients []Patient
	db.Where("status = ?", StatusPreRegistered).
		Order("appointment_time ASC").
		Find(&patients)
	c.JSON(http.StatusOK, patients)
}

func exportCSV(c *gin.Context) {
	var patients []Patient
	db.Where("DATE(created_at) = DATE('now')").
		Order("created_at ASC").
		Find(&patients)

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=clinic_records_%s.csv", time.Now().Format("20060102")))
	c.Header("Cache-Control", "no-cache")

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{"排队号", "姓名", "科室", "签到时间", "就诊开始时间", "就诊结束时间", "就诊时长(秒)", "状态", "过号次数"})

	for _, p := range patients {
		var checkInTime, visitStart, visitEnd string
		var visitDuration int64

		if p.CheckInTime != nil {
			checkInTime = p.CheckInTime.Format("2006-01-02 15:04:05")
		}
		if p.VisitStartTime != nil {
			visitStart = p.VisitStartTime.Format("2006-01-02 15:04:05")
		}
		if p.VisitEndTime != nil {
			visitEnd = p.VisitEndTime.Format("2006-01-02 15:04:05")
		}
		if p.VisitStartTime != nil && p.VisitEndTime != nil {
			visitDuration = int64(p.VisitEndTime.Sub(*p.VisitStartTime).Seconds())
		}

		statusMap := map[PatientStatus]string{
			StatusWaiting:       "候诊",
			StatusVisiting:      "就诊中",
			StatusCompleted:     "已完成",
			StatusMissed:        "已过号",
			StatusPreRegistered: "已预约",
		}

		writer.Write([]string{
			strconv.Itoa(p.QueueNumber),
			p.Name,
			p.Department,
			checkInTime,
			visitStart,
			visitEnd,
			strconv.FormatInt(visitDuration, 10),
			statusMap[p.Status],
			strconv.Itoa(p.MissedCount),
		})
	}
}

func broadcastQueueUpdate(deptName string) {
	queue, _ := getQueueWithEstimates(deptName)

	var deptInfo map[string]interface{}
	var departments []Department
	db.Where("name = ?", deptName).Find(&departments)
	if len(departments) > 0 {
		d := departments[0]
		var waitingCount int64
		db.Model(&Patient{}).Where("department = ? AND status = ?", d.Name, StatusWaiting).Count(&waitingCount)

		var visiting Patient
		visitingData := map[string]interface{}{}
		if err := db.Where("department = ? AND status = ?", d.Name, StatusVisiting).First(&visiting).Error; err == nil {
			visitingData = map[string]interface{}{
				"id":          visiting.ID,
				"name":        maskName(visiting.Name),
				"queueNumber": visiting.QueueNumber,
			}
		}

		deptInfo = map[string]interface{}{
			"id":               d.ID,
			"name":             d.Name,
			"currentCall":      d.CurrentCall,
			"doctorOnDuty":     d.DoctorOnDuty,
			"avgVisitDuration": d.AvgVisitDuration,
			"waitingCount":     waitingCount,
			"estimatedWait":    d.AvgVisitDuration * int(waitingCount),
			"visiting":         visitingData,
		}
	}

	msg := WSMessage{
		Type: "queue_update",
		Payload: map[string]interface{}{
			"department": deptName,
			"queue":      queue,
			"deptInfo":   deptInfo,
		},
	}
	data, _ := json.Marshal(msg)
	hub.broadcast <- data
}

func broadcastCallNext(deptName string, patient Patient) {
	msg := WSMessage{
		Type: "call_next",
		Payload: map[string]interface{}{
			"department": deptName,
			"patient": map[string]interface{}{
				"id":          patient.ID,
				"name":        maskName(patient.Name),
				"queueNumber": patient.QueueNumber,
			},
		},
	}
	data, _ := json.Marshal(msg)
	hub.broadcast <- data

	broadcastQueueUpdate(deptName)
}

func main() {
	godotenv.Load()
	initDB()

	hub = newHub()
	go hub.run()

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")
	{
		api.POST("/patients", createPatient)
		api.POST("/patients/:id/activate", activatePatient)
		api.POST("/patients/:id/missed", markMissed)
		api.POST("/patients/:id/requeue", requeuePatient)
		api.POST("/patients/:id/prioritize", prioritizePatient)
		api.POST("/call-next", callNext)

		api.GET("/queue", getQueue)
		api.GET("/completed", getCompleted)
		api.GET("/departments", getDepartments)
		api.GET("/preregistered", getPreRegistered)
		api.GET("/export", exportCSV)
	}

	r.GET("/ws/queue", handleWebSocket)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	log.Fatal(r.Run(":" + port))
}
