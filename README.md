# SETUP NVIDIA

nvidia-xconfig -a --cool-bits=28 --allow-empty-initial-configuration

--

My main home hypervisor is running Centos 8, and is headless. I have a need to have a PCIe graphics card plugged into it, and then adjust the clocks and fan control settings, but I really don’t want to be running an X server on it and/or have a monitor plugged in. So I figured out how to do exactly that.

This will require you to already have the nVidia Driver Toolkit installed. You can find instructions about how to do that at Server World. You’ll know you have it installed OK when nvidia-smi produces output.

Installing X
Now, this process will involve installing X, but we aren’t going to run the X server all the time - only when it’s required. Install the required X components (as root) with;

dnf config-manager --enable powertools
yum install xorg-x11-server-Xorg xorg-x11-xauth xorg-x11-apps xterm -y
nvidia-xconfig --cool-bits=31 --allow-empty-initial-configuration
systemctl set-default multi-user.target
The last command ensures that you’re still in multi-user.target, which corresponds to no X server running on boot. If you really want to switch runlevels, you can do;

# switch to graphical mode
systemctl isolate graphical.target

# switch to console mode
systemctl isolate multi-user.target
A quick word on performance levels and persistence
nVidia cards run in several ‘performance levels’. Parameters such as clock offsets etc are on a per-performance level basis. We are going to fix our GPU to performance level 2 and apply settings to that. You can query that with nvidia-settings -q gpus, when X is running.

Theoretically, these settings should be persistent, but you may want to re-run these comamnds on boot. See how you go.

Configuring the card
Now that we’re ready, the process is simply run up X, make your changes persistent, apply new settings, then close down X and you’re done. This assumes your GPU is gpu0. Adjust if required, and then do this (as root);

# start up X
xinit &
export DISPLAY=:0.0

# configure the card
nvidia-smi -pm 1                                                      # enable persistent mode
nvidia-smi -i 0 -pl 80                                                # set power rate limit at 80 watts
nvidia-settings -a "[gpu:0]/GpuPowerMizerMode=2"                      # set performance level 2 (high performance)
nvidia-settings -a '[gpu:0]/GPUFanControlState=1'                     # set manually controlled fan speed
nvidia-settings -a '[fan:0]/GPUTargetFanSpeed=75'                     # set fan speed to 75%
nvidia-settings -a '[gpu:0]/GPUGraphicsClockOffset[2]=-200'           # set the GPU clock offset to -200 MHz (underclock)
nvidia-settings -a '[gpu:0]/GPUMemoryTransferRateOffset[2]=+2200'     # set the RAM clock offset to +2200 MHz (overclock)

# shut down x
ps -ef | grep /usr/libexec/Xorg | grep -v grep | awk '{print $2}' | xargs kill
You will obviously need to tune the settings as per your requirements, but that’s what I’m doing.

---
#AMD POWER MAN

https://github.com/Shaped/amdpwrman/blob/master/amdpwrman
