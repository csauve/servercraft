#!/bin/bash

if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

echo "### CONTAINER LOG ###"
docker logs servercraft
echo "### END CONTAINER LOG ###"
echo "If the above log contains errors something went wrong and you'll have to reconfigure"
echo "If the error is 'Error: No such container: servercraft' it's normal and can be safely ignored"