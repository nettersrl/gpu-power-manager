# gpu-power-manager
A power tuning utility and a simple monitor to handle all the tuning stuff on your AMD or NVIDIA GPU over Linux.

![Alt text](/gpu-monitor-screen.jpg?raw=true "GPU Monitor tool")

# Supported plaforms
Tested on Fedora 34/35 with amdgpu opensource drivers (we do not recommend to use AMDGPU-PRO drivers) and with the latest NVIDIA proprietary drivers.
Please note that this software is meant for headless system, so there is no Xorg or Wayland session running on our host while we are using it.

# Setup
You should install all the packages needed to run:
- an X.org server, this is needed by nvidia-xsettings
- nodejs and npm

# NVIDIA coolbits settings
In order to enable power tuning, you should run this command if you own NVIDIA cards:
- *nvidia-xconfig -a --cool-bits=28 --allow-empty-initial-configuration*

# AMD Feature Mask
In order to enable power tuning, you should run this command if you own AMD cards:
- add *amdgpu.ppfeaturemask=0xffffffff* to your grub

# Power profile setting
Move settings.json.example file to settings.json and add your graphic card power profile. 
If you need to create a power tuning profile for your own gpu, then create an object inside settings.json file in a uppercased format spaced with underscores. Then also add its target gpu's model id and subvendor id in the headers/gpuProps.ts file using the same name defined on settings.json and adding the suffixes _DEVICE_ID and _SUBDEVICEVENDOR_ID

Then run *npm i* on the project dir, *npm run compile* and finally:
- *sudo node dist/run.js* to run the tuner. You may want to skip a certain vendor from the run by specifying the env variables AMD and NVIDIA with the value _false_
- *node dist/monitor.js* to run the tabular monitor

# SystemD service file
If you want to run the tuner when the system boots up you should place this project in */opt/mining/power_manager*
Then place the systemd service file in the system path you prefer and then *systemctl daemon-reload*
In the systemd_services folder you will also find an *after-setup.service* that can be used as example to create a systemd service which should await for gpu-setup before starting up.
