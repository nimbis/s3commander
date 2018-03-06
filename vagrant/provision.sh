#!/bin/bash

# update package lists
apt-get update

# upgrade system packages
UPGRADE_FLAG="/root/.vagrant_dist_upgrade"
if [ ! -f "${UPGRADE_FLAG}" ]; then
  apt-get -y dist-upgrade && touch "${UPGRADE_FLAG}"
fi

# configure the nodesource package repository
# https://github.com/nodesource/distributions#debmanual
NS_VERSION="node_9.x"
NS_APT_LIST="/etc/apt/sources.list.d/nodesource.list"
NS_APT_KEY_URL="https://deb.nodesource.com/gpgkey/nodesource.gpg.key"

if [ ! -f "${NS_APT_LIST}" ]; then
  # detect the distribution (i.e. trusty, xenial, etc)
  DISTRO="$(lsb_release -s -c)"

  # create the apt source file
  echo "deb https://deb.nodesource.com/$NS_VERSION $DISTRO main" > "${NS_APT_LIST}"
  echo "deb-src https://deb.nodesource.com/$NS_VERSION $DISTRO main" >> "${NS_APT_LIST}"

  # import the signing key
  curl --silent "${NS_APT_KEY_URL}" | apt-key add -

  # update package lists again
  apt-get update
fi

# install nodejs
dpkg -l npdejs &> /dev/null
if [ $? -eq 1 ]; then
  apt-get -y install nodejs
fi

# install npm
dpkg -l npm &> /dev/null
if [ $? -eq 1 ]; then
  apt-get -y install npm
fi

# install global npm packages
npm install -g gulp-cli
