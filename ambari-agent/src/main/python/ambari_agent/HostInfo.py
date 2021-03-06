#!/usr/bin/env python

'''
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
'''

import glob
import logging
import os
import re
import shlex
import socket
import subprocess
import time

from ambari_commons import OSCheck, OSConst
from ambari_commons.firewall import Firewall
from ambari_commons.os_family_impl import OsFamilyImpl

from ambari_agent.HostCheckReportFileHandler import HostCheckReportFileHandler


logger = logging.getLogger()

# service cmd
SERVICE_CMD = "service"


class HostInfo(object):
  # Filters used to identify processed
  PROC_FILTER = [
    "hadoop", "zookeeper"
  ]

  RESULT_UNAVAILABLE = "unable_to_determine"

  current_umask = -1

  def __init__(self, config=None):
    self.config = config
    self.reportFileHandler = HostCheckReportFileHandler(config)

  def dirType(self, path):
    if not os.path.exists(path):
      return 'not_exist'
    elif os.path.islink(path):
      return 'sym_link'
    elif os.path.isdir(path):
      return 'directory'
    elif os.path.isfile(path):
      return 'file'
    return 'unknown'

  def checkLiveServices(self, services, result):
    osType = OSCheck.get_os_family()
    for service in services:
      svcCheckResult = {}
      serviceName = service
      svcCheckResult['name'] = serviceName
      svcCheckResult['status'] = "UNKNOWN"
      svcCheckResult['desc'] = ""
      try:
        out, err, code = self.getServiceStatus(serviceName)
        if 0 != code:
          svcCheckResult['status'] = "Unhealthy"
          svcCheckResult['desc'] = out
          if len(out) == 0:
            svcCheckResult['desc'] = err
        else:
          svcCheckResult['status'] = "Healthy"
      except Exception, e:
        svcCheckResult['status'] = "Unhealthy"
        svcCheckResult['desc'] = repr(e)
      result.append(svcCheckResult)

  def getUMask(self):
    if (self.current_umask == -1):
      self.current_umask = os.umask(self.current_umask)
      os.umask(self.current_umask)
      return self.current_umask
    else:
      return self.current_umask

  def checkFirewall(self):
    return Firewall().getFirewallObject().check_firewall()

  def getFirewallName(self):
    return Firewall().getFirewallObject().get_firewall_name()

  def checkReverseLookup(self):
    """
    Check if host fqdn resolves to current host ip
    """
    try:
      host_name = socket.gethostname().lower()
      host_ip = socket.gethostbyname(host_name)
      host_fqdn = socket.getfqdn().lower()
      fqdn_ip = socket.gethostbyname(host_fqdn)
      return host_ip == fqdn_ip
    except socket.error:
      pass
    return False

def get_ntp_service():
  if OSCheck.is_redhat_family():
    return "ntpd"
  elif OSCheck.is_suse_family() or OSCheck.is_ubuntu_family():
    return "ntp"


@OsFamilyImpl(os_family=OsFamilyImpl.DEFAULT)
class HostInfoLinux(HostInfo):
  # List of project names to be used to find alternatives folders etc.
  DEFAULT_PROJECT_NAMES = [
    "hadoop*", "hadoop", "hbase", "hcatalog", "hive", "ganglia",
    "oozie", "sqoop", "hue", "zookeeper", "mapred", "hdfs", "flume",
    "storm", "hive-hcatalog", "tez", "falcon", "ambari_qa", "hadoop_deploy",
    "rrdcached", "hcat", "ambari-qa", "sqoop-ambari-qa", "sqoop-ambari_qa",
    "webhcat", "hadoop-hdfs", "hadoop-yarn", "hadoop-mapreduce",
    "knox", "yarn", "hive-webhcat", "kafka", "slider", "storm-slider-client",
    "ganglia-web"
  ]


  # List of live services checked for on the host, takes a map of plan strings
  DEFAULT_LIVE_SERVICES = [
    get_ntp_service()
  ]
  # Set of default users (need to be replaced with the configured user names)
  DEFAULT_USERS = [
    "hive", "ambari-qa", "oozie", "hbase", "hcat", "mapred",
    "hdfs", "rrdcached", "zookeeper", "flume", "sqoop", "sqoop2",
    "hue", "yarn", "tez", "storm", "falcon", "kafka", "knox"
  ]

  # Default set of directories that are checked for existence of files and folders
  DEFAULT_DIRS = [
    "/etc", "/var/run", "/var/log", "/usr/lib", "/var/lib", "/var/tmp", "/tmp", "/var",
    "/hadoop", "/usr/hdp"
  ]

  DEFAULT_SERVICE_NAME = "ntpd"
  SERVICE_STATUS_CMD = "%s %s status" % (SERVICE_CMD, DEFAULT_SERVICE_NAME)

  THP_FILE = "/sys/kernel/mm/redhat_transparent_hugepage/enabled"

  def __init__(self, config=None):
    super(HostInfoLinux, self).__init__(config)

  def checkUsers(self, users, results):
    f = open('/etc/passwd', 'r')
    for userLine in f:
      fields = userLine.split(":")
      if fields[0] in users:
        result = {}
        result['name'] = fields[0]
        result['homeDir'] = fields[5]
        result['status'] = "Available"
        results.append(result)

  def checkFolders(self, basePaths, projectNames, existingUsers, dirs):
    foldersToIgnore = []
    for user in existingUsers:
      foldersToIgnore.append(user['homeDir'])
    try:
      for dirName in basePaths:
        for project in projectNames:
          path = os.path.join(dirName.strip(), project.strip())
          if not path in foldersToIgnore and os.path.exists(path):
            obj = {}
            obj['type'] = self.dirType(path)
            obj['name'] = path
            dirs.append(obj)
    except:
      pass

  def javaProcs(self, list):
    import pwd

    try:
      pids = [pid for pid in os.listdir('/proc') if pid.isdigit()]
      for pid in pids:
        cmd = open(os.path.join('/proc', pid, 'cmdline'), 'rb').read()
        cmd = cmd.replace('\0', ' ')
        if not 'AmbariServer' in cmd:
          if 'java' in cmd:
            dict = {}
            dict['pid'] = int(pid)
            dict['hadoop'] = False
            for filter in self.PROC_FILTER:
              if filter in cmd:
                dict['hadoop'] = True
            dict['command'] = cmd.strip()
            for line in open(os.path.join('/proc', pid, 'status')):
              if line.startswith('Uid:'):
                uid = int(line.split()[1])
                dict['user'] = pwd.getpwuid(uid).pw_name
            list.append(dict)
    except:
      pass
    pass

  def getTransparentHugePage(self):
    # This file exist only on redhat 6
    thp_regex = "\[(.+)\]"
    if os.path.isfile(self.THP_FILE):
      with open(self.THP_FILE) as f:
        file_content = f.read()
        return re.search(thp_regex, file_content).groups()[0]
    else:
      return ""

  def hadoopVarRunCount(self):
    if not os.path.exists('/var/run/hadoop'):
      return 0
    pids = glob.glob('/var/run/hadoop/*/*.pid')
    return len(pids)

  def hadoopVarLogCount(self):
    if not os.path.exists('/var/log/hadoop'):
      return 0
    logs = glob.glob('/var/log/hadoop/*/*.log')
    return len(logs)

  def etcAlternativesConf(self, projects, etcResults):
    if not os.path.exists('/etc/alternatives'):
      return []
    projectRegex = "'" + '|'.join(projects) + "'"
    files = [f for f in os.listdir('/etc/alternatives') if re.match(projectRegex, f)]
    for conf in files:
      result = {}
      filePath = os.path.join('/etc/alternatives', conf)
      if os.path.islink(filePath):
        realConf = os.path.realpath(filePath)
        result['name'] = conf
        result['target'] = realConf
        etcResults.append(result)

  def register(self, dict, componentsMapped=True, commandsInProgress=True):
    """ Return various details about the host
    componentsMapped: indicates if any components are mapped to this host
    commandsInProgress: indicates if any commands are in progress
    """

    dict['hostHealth'] = {}

    java = []
    self.javaProcs(java)
    dict['hostHealth']['activeJavaProcs'] = java

    liveSvcs = []
    self.checkLiveServices(self.DEFAULT_LIVE_SERVICES, liveSvcs)
    dict['hostHealth']['liveServices'] = liveSvcs

    dict['umask'] = str(self.getUMask())

    dict['transparentHugePage'] = self.getTransparentHugePage()
    dict['firewallRunning'] = self.checkFirewall()
    dict['firewallName'] = self.getFirewallName()
    dict['reverseLookup'] = self.checkReverseLookup()
    # If commands are in progress or components are already mapped to this host
    # Then do not perform certain expensive host checks
    if componentsMapped or commandsInProgress:
      dict['alternatives'] = []
      dict['stackFoldersAndFiles'] = []
      dict['existingUsers'] = []

    else:
      etcs = []
      self.etcAlternativesConf(self.DEFAULT_PROJECT_NAMES, etcs)
      dict['alternatives'] = etcs

      existingUsers = []
      self.checkUsers(self.DEFAULT_USERS, existingUsers)
      dict['existingUsers'] = existingUsers

      dirs = []
      self.checkFolders(self.DEFAULT_DIRS, self.DEFAULT_PROJECT_NAMES, existingUsers, dirs)
      dict['stackFoldersAndFiles'] = dirs

      self.reportFileHandler.writeHostCheckFile(dict)
      pass

    # The time stamp must be recorded at the end
    dict['hostHealth']['agentTimeStampAtReporting'] = int(time.time() * 1000)

    pass

  def getServiceStatus(self, serivce_name):
    service_check_live = shlex.split(self.SERVICE_STATUS_CMD)
    service_check_live[1] = serivce_name
    osStat = subprocess.Popen(service_check_live, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE)
    out, err = osStat.communicate()
    return out, err, osStat.returncode


@OsFamilyImpl(os_family=OSConst.WINSRV_FAMILY)
class HostInfoWindows(HostInfo):
  SERVICE_STATUS_CMD = 'If ((Get-Service | Where-Object {{$_.Name -eq \'{0}\'}}).Status -eq \'Running\') {{echo "Running"; $host.SetShouldExit(0)}} Else {{echo "Stopped"; $host.SetShouldExit(1)}}'
  GET_USERS_CMD = '$accounts=(Get-WmiObject -Class Win32_UserAccount -Namespace "root\cimv2" -Filter "name = \'{0}\' and Disabled=\'False\'" -ErrorAction Stop); foreach ($acc in $accounts) {{Write-Host ($acc.Domain + "\\" + $acc.Name)}}'
  GET_JAVA_PROC_CMD = 'foreach ($process in (gwmi Win32_Process -Filter "name = \'java.exe\'")){{echo $process.ProcessId;echo $process.CommandLine; echo $process.GetOwner().User}}'
  DEFAULT_LIVE_SERVICES = [
    "W32Time"
  ]
  DEFAULT_USERS = "hadoop"

  def checkUsers(self, user_mask, results):
    get_users_cmd = ["powershell", '-noProfile', '-NonInteractive', '-nologo', "-Command", self.GET_USERS_CMD.format(user_mask)]
    try:
      osStat = subprocess.Popen(get_users_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
      out, err = osStat.communicate()
    except:
      raise Exception("Failed to get users.")
    for user in out.split(os.linesep):
      result = {}
      result['name'] = user
      result['homeDir'] = ""
      result['status'] = "Available"
      results.append(result)

  def createAlerts(self, alerts):
    # TODO AMBARI-7849 Implement createAlerts for Windows
    return alerts

  def javaProcs(self, list):
    try:
      from ambari_commons.os_windows import run_powershell_script

      code, out, err = run_powershell_script(self.GET_JAVA_PROC_CMD)
      if code == 0:
        splitted_output = out.split(os.linesep)
        for i in [index for index in range(0, len(splitted_output)) if (index % 3) == 0]:
          pid = splitted_output[i]
          cmd = splitted_output[i + 1]
          user = splitted_output[i + 2]
          if not 'AmbariServer' in cmd:
            if 'java' in cmd:
              dict = {}
              dict['pid'] = int(pid)
              dict['hadoop'] = False
              for filter in self.PROC_FILTER:
                if filter in cmd:
                  dict['hadoop'] = True
              dict['command'] = cmd.strip()
              dict['user'] = user
              list.append(dict)
    except Exception as e:
      pass
    pass

  def getServiceStatus(self, serivce_name):
    from ambari_commons.os_windows import run_powershell_script
    code, out, err = run_powershell_script(self.SERVICE_STATUS_CMD.format(serivce_name))
    return out, err, code

  def register(self, dict, componentsMapped=True, commandsInProgress=True):
    """ Return various details about the host
    componentsMapped: indicates if any components are mapped to this host
    commandsInProgress: indicates if any commands are in progress
    """
    dict['hostHealth'] = {}

    java = []
    self.javaProcs(java)
    dict['hostHealth']['activeJavaProcs'] = java

    liveSvcs = []
    self.checkLiveServices(self.DEFAULT_LIVE_SERVICES, liveSvcs)
    dict['hostHealth']['liveServices'] = liveSvcs

    dict['umask'] = str(self.getUMask())

    dict['firewallRunning'] = self.checkFirewall()
    dict['firewallName'] = self.getFirewallName()
    dict['reverseLookup'] = self.checkReverseLookup()
    # If commands are in progress or components are already mapped to this host
    # Then do not perform certain expensive host checks
    if componentsMapped or commandsInProgress:
      dict['alternatives'] = []
      dict['stackFoldersAndFiles'] = []
      dict['existingUsers'] = []
    else:
      existingUsers = []
      self.checkUsers(self.DEFAULT_USERS, existingUsers)
      dict['existingUsers'] = existingUsers
      # TODO check HDP stack and folders here
      self.reportFileHandler.writeHostCheckFile(dict)
      pass

    # The time stamp must be recorded at the end
    dict['hostHealth']['agentTimeStampAtReporting'] = int(time.time() * 1000)



def main(argv=None):
  h = HostInfo()
  struct = {}
  h.register(struct)
  print struct


if __name__ == '__main__':
  main()
