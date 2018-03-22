# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  # common
  config.vm.box = "ubuntu/xenial64"
  config.vm.provision "shell", path: "vagrant/provision.sh"

  # development vm
  config.vm.define "dev" do |dev|
    dev.vm.hostname = "dev"
    dev.vm.provider "virtualbox" do |vb|
      vb.memory = 1024
      vb.cpus = 1

      # disable log file
      # https://bugs.launchpad.net/cloud-images/+bug/1639732
      vb.customize ["modifyvm", :id, "--uartmode1", "disconnected"]
    end

    # gulp serve HTTP port
    dev.vm.network "forwarded_port", guest: 3000, host: 3000
  end
end
