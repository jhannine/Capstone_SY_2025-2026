# 🌿 IoT-Based Real-Time Monitoring and Relocation Recommendation System for Lato Seaweed Farming in Calatagan, Batangas

An Internet of Things (IoT)-based monitoring system designed to monitor environmental conditions affecting the growth and health of **Lato (*Caulerpa lentillifera*)** seaweed farms in Calatagan, Batangas.

---

## Group Members

- **Angelo Jugo** — Software Engineer
- **John Lloyd Gamez** — System Tester
- **Jhannine De La Rosa** — System Analyst

---

# Introduction

## Purpose

The project aims to develop an IoT-based monitoring system that collects and displays environmental data essential for Lato seaweed farming.

The system monitors the following environmental parameters:

- 🌡️ Water Temperature
- 🧂 Salinity
- ⚗️ pH Level
- ☀️ Sunlight Intensity (Irradiance)

Collected data are displayed through a mobile application to assist seaweed farmers in monitoring the condition of their farms.

---

## Scope

### Included

- Environmental monitoring
- Mobile application for data visualization
- Cloud database storage
- Notifications when environmental values exceed acceptable thresholds

### Not Included

- Automatic control mechanisms
- AI-based disease prediction
- Automated water treatment

---

# Definitions, Acronyms, and Abbreviations

| Term | Meaning |
|------|---------|
| IoT | Internet of Things |
| API | Application Programming Interface |
| ESP32 | Microcontroller used for sensor communication |
| pH | Measure of acidity or alkalinity |
| UI | User Interface |
| DB | Database |
| GPS | Global Positioning System |

---

# System Architecture

```text
Sensors
(pH, Salinity, Temperature, Irradiance)
                │
                ▼
             ESP32
                │
                ▼
            PHP REST API
                │
                ▼
         MySQL Database
                │
                ▼
   React Native Mobile App
                │
                ▼
          User / Farmer
```

---

# Hardware Components

- ESP32 Development Board
- pH Sensor
- Salinity Sensor
- Temperature Sensor
- Light Sensor

---

# Software Stack

## Frontend

- React Native
- Expo
- TypeScript

## Backend

- PHP REST API

## Database

- MySQL

## Version Control

- Git
- GitHub

---

# Current Features

### Fully Functional

- ✅ Mobile application
- ✅ Dashboard displaying environmental data
- ✅ API integration between frontend and backend
- ✅ MySQL database storage
- ✅ Real-time fetching of water temperature
- ✅ Real-time fetching of sunlight intensity
- ✅ Monitoring status display:
  - Normal
  - Warning
  - Critical

---

# API Integration

## Connected APIs

### ✅ Open-Meteo API

Provides:

- Temperature
- Solar Radiation

---

## Planned Integration

### ⚠️ Copernicus Marine Service

Will provide:

- Salinity datasets
- Ocean pH datasets

---

# Mocked / Simulated Components

For project demonstration purposes, the following components are currently simulated while hardware integration is still in progress.

## pH Sensor

```json
{
  "ph": 7.8
}
```

## Salinity Sensor

```json
{
  "salinity": 33.5
}
```

These values are currently generated using a mock API.

---

# Project Status

| Module | Status |
|---------|--------|
| Mobile Application UI | ✅ Completed |
| Database Design | ✅ Completed |
| API Development | ✅ Completed |
| Temperature Integration | ✅ Completed |
| Sunlight Integration | ✅ Completed |
| Salinity Integration | 🔄 Ongoing |
| pH Integration | 🔄 Ongoing |
| Sensor Deployment | 🔄 Ongoing |
| Testing | 🔄 Ongoing |

---

# Future Improvements

- Deploy actual sensors in Lato farms located in Calatagan, Batangas
- Push notification support
- Historical analytics and graphical reports
- Machine learning prediction for seaweed health
- Cloud synchronization improvements
- Multi-user support for farmers and administrators

---

# Technologies Used

| Category | Technology |
|----------|------------|
| Mobile | React Native |
| Framework | Expo |
| Language | TypeScript |
| Backend | PHP REST API |
| Database | MySQL |
| Hardware | ESP32 |
| APIs | Open-Meteo, Copernicus Marine Service (Planned) |
| Version Control | Git, GitHub |

---

## License

This project is developed for academic purposes as part of our capstone/research project.
