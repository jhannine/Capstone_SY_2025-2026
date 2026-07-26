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
- MySQL data storage
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
| ESP32 | Microcontroller intended for future physical sensor communication |
| pH | Measure of acidity or alkalinity |
| UI | User Interface |
| DB | Database |
| GPS | Global Positioning System |

---

# System Architecture

The system currently operates using a **remote-sensing / API-based data pipeline** while physical IoT hardware is still being deployed. Two data flows exist side by side:

## Current Implementation (Active)

```text
   Open-Meteo API                Copernicus Marine
(Temperature, Sunlight)         Salinity Dataset (.nc)
         │                              │
         └───────────────┬──────────────┘
                          ▼
                  Flask REST API
                   (Python backend)
                          │
                          ▼
                  MySQL Database
                          │
                          ▼
           React Native / Expo Mobile App
                          │
                          ▼
                   User / Farmer
```

- **Water Temperature & Sunlight Intensity** — fetched live from the Open-Meteo weather API for the farm's coordinates.
- **Salinity** — read from Copernicus Marine Service salinity datasets (`.nc` files) covering the farm location.
- **pH Level** — not yet available; no data source is currently connected, so this field remains blank until a sensor is deployed.

## Planned Full Deployment (Future)

```text
        Physical Sensors
(pH, Salinity, Temperature, Light)
                │
                ▼
             ESP32
                │
                ▼
         Flask REST API
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

Once physical sensor nodes are installed on-site, readings will transition from remote/satellite-derived estimates to direct in-water measurements via ESP32, with the same backend and mobile app consuming the data.

---

# Hardware Components (Planned for On-Site Deployment)

- ESP32 Development Board
- pH Sensor
- Salinity Sensor
- Temperature Sensor
- Light Sensor

> Note: these components are part of the planned on-site sensor deployment and are not yet what powers the current live data — see "Current Implementation" above.

---

# Software Stack

## Frontend

- React Native
- Expo (Expo Router)
- TypeScript

## Backend

- Python
- Flask (REST API)

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
- ✅ Real-time fetching of water temperature (via Open-Meteo API)
- ✅ Real-time fetching of sunlight intensity (via Open-Meteo API)
- ✅ Salinity readings from Copernicus Marine Service datasets
- ✅ Historical data logging and per-day analytics (graph + table view)
- ✅ Data export (CSV/PDF) for a selected date range
- ✅ Monitoring status display:
  - Normal
  - Warning
  - Critical

### Not Yet Available

- ⏳ pH Level readings (no data source connected yet)
- ⏳ Physical, on-site sensor readings (ESP32 hardware not yet deployed)

---

# API Integration

## Connected APIs

### ✅ Open-Meteo API

Provides:

- Temperature
- Solar Radiation (Sunlight Intensity)

### ✅ Copernicus Marine Service

Provides:

- Salinity datasets (`.nc` files)

## Planned Integration

### ⚠️ Physical pH Sensor (via ESP32)

Will provide:

- Direct pH measurements once on-site hardware is deployed

---

# Project Status

| Module | Status |
|---------|--------|
| Mobile Application UI | ✅ Completed |
| Database Design | ✅ Completed |
| API Development | ✅ Completed |
| Temperature Integration | ✅ Completed |
| Sunlight Integration | ✅ Completed |
| Salinity Integration | ✅ Completed |
| Historical Analytics (Graph/Table) | ✅ Completed |
| Data Export (CSV/PDF) | ✅ Completed |
| pH Integration | 🔄 Ongoing |
| Sensor Deployment (ESP32) | 🔄 Ongoing |
| Testing | 🔄 Ongoing |

---

# Future Improvements

- Deploy actual ESP32-based sensors in Lato farms located in Calatagan, Batangas
- Integrate a physical pH sensor
- Push notification support
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
| Backend | Flask (Python) |
| Database | MySQL |
| Hardware (Planned) | ESP32 |
| APIs | Open-Meteo, Copernicus Marine Service |
| Version Control | Git, GitHub |

---

## License

This project is developed for academic purposes as part of our capstone/research project.
