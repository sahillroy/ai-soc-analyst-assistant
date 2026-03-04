import pandas as pd
import numpy as np
from datetime import datetime, timedelta #to generate timestamps
import random # to generate randon values

num_normal = 500  #created 500 normal logs
num_attack = 50   #created 50 attaack logs

def random_ip():
    return f"192.168.1.{random.randint(1,254)}"
#This fuction generates random IP

def random_timestamp():
    base = datetime.now()
    return base - timedelta(minutes=random.randint(0,1000))
#This generates timestamps by subtracting random minutes from current time
#It is important for time based detection

data = [] #This will store all logs before converting into a DataFrame.

# Normal traffic
for _ in range(num_normal): #It will run 500 times 
    data.append([
        random_timestamp(), #time of event
        random_ip(),  # user IP
        "10.0.0.5", # server IP
        random.choice([80,443]), #port number
        "TCP", #protocol
        random.randint(200,2000), #byte transferred
        random.randint(0,2) #login attempts
    ])
    
for _ in range(num_attack):
    data.append([
    random_timestamp(),
    "192.168.1.250",
    "10.0.0.5",
    22,
    "TCP",
    random.randint(5000, 20000),
    random.randint(10,20)
    ])
#This models SSH brute force attacks

columns = [
    "timestamp",
    "source_ip",
    "destination_ip",
    "port",
    "protocol",
    "bytes_transferred",
    "failed_logins"
]

df = pd.DataFrame(data,columns = columns) # Converting it into table
df.to_csv("logs.csv",index=False) # Saving as CSV

print("Logs generated successfully")