# updater.py

import schedule
import time
import os

def update():
    os.system("python download_salinity.py")
    print("Updated!")

schedule.every().day.at("06:00").do(update)

while True:
    schedule.run_pending()
    time.sleep(60)