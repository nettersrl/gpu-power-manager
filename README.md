# gpu-power-manager
A power tuning utility and a simple monitor to handle all the tuning stuff on your AMD or NVIDIA GPU over Linux.

# Supported plaforms
Tested on Fedora 34/35 with amdgpu opensource drivers (we do not recommend to use AMDGPU-PRO drivers) and with the latest NVIDIA proprietary drivers.

# Setup
You should install all the packages needed to run:
- an X.org server, this is needed by nvidia-xsettings
- nodejs and npm

# Power profile setting
Move settings.json.example file to settings.json and add your graphic card power profile. 
If you need to create a power tuning profile for your own gpu, then create an object inside settings.json file in a uppercased format spaced with underscores. Then also add its target gpu's model id and subvendor id in the headers/gpuProps.ts file using the same name defined on settings.json and adding the suffixes _DEVICE_ID and _SUBDEVICEVENDOR_ID

Then run *npm i* on the project dir, *npm run compile* and finally:
- *sudo node dist/run.js* to run the tuner. You may want to skip a certain vendor from the run by specifying the env variables AMD and NVIDIA with the value _false_
- *node dist/monitor.js* to run the tabular monitor
