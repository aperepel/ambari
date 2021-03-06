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
import json
from mock.mock import MagicMock, patch
from stacks.utils.RMFTestCase import *

@patch("resource_management.libraries.functions.get_hdp_version", new=MagicMock(return_value="2.3.0.0-1597"))
class TestJobHistoryServer(RMFTestCase):
  COMMON_SERVICES_PACKAGE_DIR = "SPARK/1.2.0.2.2/package"
  STACK_VERSION = "2.2"

  def test_configure_default(self):
    self.executeScript(self.COMMON_SERVICES_PACKAGE_DIR + "/scripts/job_history_server.py",
                   classname = "JobHistoryServer",
                   command = "configure",
                   config_file="default.json",
                   hdp_stack_version = self.STACK_VERSION,
                   target = RMFTestCase.TARGET_COMMON_SERVICES
    )
    self.assert_configure_default()
    self.assertNoMoreResources()
    
  def test_start_default(self):
    self.executeScript(self.COMMON_SERVICES_PACKAGE_DIR + "/scripts/job_history_server.py",
                   classname = "JobHistoryServer",
                   command = "start",
                   config_file="default.json",
                   hdp_stack_version = self.STACK_VERSION,
                   target = RMFTestCase.TARGET_COMMON_SERVICES
    )
    self.assert_configure_default()
    self.assertResourceCalled('Execute', '/usr/hdp/current/spark-client/sbin/start-history-server.sh',
        environment = {'JAVA_HOME': u'/usr/jdk64/jdk1.7.0_45'},
        not_if = 'ls /var/run/spark/spark-spark-org.apache.spark.deploy.history.HistoryServer-1.pid >/dev/null 2>&1 && ps -p `cat /var/run/spark/spark-spark-org.apache.spark.deploy.history.HistoryServer-1.pid` >/dev/null 2>&1',
        user = 'spark',
    )
    self.assertNoMoreResources()
    
  def test_stop_default(self):
    self.executeScript(self.COMMON_SERVICES_PACKAGE_DIR + "/scripts/job_history_server.py",
                   classname = "JobHistoryServer",
                   command = "stop",
                   config_file="default.json",
                   hdp_stack_version = self.STACK_VERSION,
                   target = RMFTestCase.TARGET_COMMON_SERVICES
    )
    self.assertResourceCalled('Execute', '/usr/hdp/current/spark-client/sbin/stop-history-server.sh',
        environment = {'JAVA_HOME': u'/usr/jdk64/jdk1.7.0_45'},
        user = 'spark',
    )
    self.assertResourceCalled('File', '/var/run/spark/spark-spark-org.apache.spark.deploy.history.HistoryServer-1.pid',
        action = ['delete'],
    )
    self.assertNoMoreResources()
    
  def test_configure_secured(self):
    self.executeScript(self.COMMON_SERVICES_PACKAGE_DIR + "/scripts/job_history_server.py",
                   classname = "JobHistoryServer",
                   command = "configure",
                   config_file="secured.json",
                   hdp_stack_version = self.STACK_VERSION,
                   target = RMFTestCase.TARGET_COMMON_SERVICES
    )
    self.assert_configure_secured()
    self.assertNoMoreResources()
    
  def test_start_secured(self):
    self.executeScript(self.COMMON_SERVICES_PACKAGE_DIR + "/scripts/job_history_server.py",
                   classname = "JobHistoryServer",
                   command = "start",
                   config_file="secured.json",
                   hdp_stack_version = self.STACK_VERSION,
                   target = RMFTestCase.TARGET_COMMON_SERVICES
    )
    self.assert_configure_secured()
    self.assertResourceCalled('Execute', '/usr/bin/kinit -kt /etc/security/keytabs/spark.service.keytab spark/localhost@EXAMPLE.COM; ',
        user = 'spark',
    )
    self.assertResourceCalled('HdfsResource', 'hdfs:///hdp/apps/2.2.0.0/tez//tez.tar.gz',
        security_enabled = True,
        hadoop_conf_dir = '/usr/hdp/current/hadoop-client/conf',
        keytab = UnknownConfigurationMock(),
        source = '/usr/hdp/current/tez-client/lib/tez.tar.gz',
        kinit_path_local = '/usr/bin/kinit',
        user = UnknownConfigurationMock(),
        owner = UnknownConfigurationMock(),
        group = 'hadoop',
        hadoop_bin_dir = '/usr/hdp/current/hadoop-client/bin',
        type = 'file',
        action = ['create_on_execute'],
    )
    self.assertResourceCalled('HdfsResource', None,
        security_enabled = True,
        hadoop_bin_dir = '/usr/hdp/current/hadoop-client/bin',
        keytab = UnknownConfigurationMock(),
        kinit_path_local = '/usr/bin/kinit',
        user = UnknownConfigurationMock(),
        action = ['execute'],
        hadoop_conf_dir = '/usr/hdp/current/hadoop-client/conf',
    )
    self.assertResourceCalled('Execute', '/usr/hdp/current/spark-client/sbin/start-history-server.sh',
        environment = {'JAVA_HOME': u'/usr/jdk64/jdk1.7.0_45'},
        not_if = 'ls /var/run/spark/spark-spark-org.apache.spark.deploy.history.HistoryServer-1.pid >/dev/null 2>&1 && ps -p `cat /var/run/spark/spark-spark-org.apache.spark.deploy.history.HistoryServer-1.pid` >/dev/null 2>&1',
        user = 'spark',
    )
    self.assertNoMoreResources()
    
  def test_stop_secured(self):
    self.executeScript(self.COMMON_SERVICES_PACKAGE_DIR + "/scripts/job_history_server.py",
                   classname = "JobHistoryServer",
                   command = "stop",
                   config_file="secured.json",
                   hdp_stack_version = self.STACK_VERSION,
                   target = RMFTestCase.TARGET_COMMON_SERVICES
    )
    self.assertResourceCalled('Execute', '/usr/hdp/current/spark-client/sbin/stop-history-server.sh',
        environment = {'JAVA_HOME': u'/usr/jdk64/jdk1.7.0_45'},
        user = 'spark',
    )
    self.assertResourceCalled('File', '/var/run/spark/spark-spark-org.apache.spark.deploy.history.HistoryServer-1.pid',
        action = ['delete'],
    )
    self.assertNoMoreResources()

  def assert_configure_default(self):
    self.assertResourceCalled('Directory', '/var/run/spark',
        owner = 'spark',
        group = 'hadoop',
        recursive = True,
    )
    self.assertResourceCalled('Directory', '/var/log/spark',
        owner = 'spark',
        group = 'hadoop',
        recursive = True,
    )
    self.assertResourceCalled('HdfsResource', '/user/spark',
        security_enabled = False,
        hadoop_bin_dir = '/usr/hdp/current/hadoop-client/bin',
        keytab = UnknownConfigurationMock(),
        kinit_path_local = '/usr/bin/kinit',
        user = 'hdfs',
        owner = 'spark',
        hadoop_conf_dir = '/usr/hdp/current/hadoop-client/conf',
        type = 'directory',
        action = ['create_on_execute'],
        mode = 0775,
    )
    self.assertResourceCalled('HdfsResource', None,
        security_enabled = False,
        hadoop_bin_dir = '/usr/hdp/current/hadoop-client/bin',
        keytab = UnknownConfigurationMock(),
        kinit_path_local = '/usr/bin/kinit',
        user = 'hdfs',
        action = ['execute'],
        hadoop_conf_dir = '/usr/hdp/current/hadoop-client/conf',
    )
    self.assertResourceCalled('PropertiesFile', '/usr/hdp/current/spark-client/conf/spark-defaults.conf',
        key_value_delimiter = ' ',
        properties = self.getConfig()['configurations']['spark-defaults'],
    )
    self.assertResourceCalled('File', '/usr/hdp/current/spark-client/conf/spark-env.sh',
        content = InlineTemplate(self.getConfig()['configurations']['spark-env']['content']),
        owner = 'spark',
        group = 'spark',
    )
    self.assertResourceCalled('File', '/usr/hdp/current/spark-client/conf/log4j.properties',
        content = '\n# Set everything to be logged to the console\nlog4j.rootCategory=INFO, console\nlog4j.appender.console=org.apache.log4j.ConsoleAppender\nlog4j.appender.console.target=System.err\nlog4j.appender.console.layout=org.apache.log4j.PatternLayout\nlog4j.appender.console.layout.ConversionPattern=%d{yy/MM/dd HH:mm:ss} %p %c{1}: %m%n\n\n# Settings to quiet third party logs that are too verbose\nlog4j.logger.org.eclipse.jetty=WARN\nlog4j.logger.org.eclipse.jetty.util.component.AbstractLifeCycle=ERROR\nlog4j.logger.org.apache.spark.repl.SparkIMain$exprTyper=INFO\nlog4j.logger.org.apache.spark.repl.SparkILoop$SparkILoopInterpreter=INFO',
        owner = 'spark',
        group = 'spark',
    )
    self.assertResourceCalled('File', '/usr/hdp/current/spark-client/conf/metrics.properties',
        content = InlineTemplate(self.getConfig()['configurations']['spark-metrics-properties']['content']),
        owner = 'spark',
        group = 'spark',
    )
    self.assertResourceCalled('File', '/usr/hdp/current/spark-client/conf/java-opts',
        content = '  -Dhdp.version=2.3.0.0-1597',
        owner = 'spark',
        group = 'spark',
    )
      
  def assert_configure_secured(self):
    self.assertResourceCalled('Directory', '/var/run/spark',
        owner = 'spark',
        group = 'hadoop',
        recursive = True,
    )
    self.assertResourceCalled('Directory', '/var/log/spark',
        owner = 'spark',
        group = 'hadoop',
        recursive = True,
    )
    self.assertResourceCalled('HdfsResource', '/user/spark',
        security_enabled = True,
        hadoop_bin_dir = '/usr/hdp/current/hadoop-client/bin',
        keytab = UnknownConfigurationMock(),
        kinit_path_local = '/usr/bin/kinit',
        user = UnknownConfigurationMock(),
        owner = 'spark',
        hadoop_conf_dir = '/usr/hdp/current/hadoop-client/conf',
        type = 'directory',
        action = ['create_on_execute'],
        mode = 0775,
    )
    self.assertResourceCalled('HdfsResource', None,
        security_enabled = True,
        hadoop_bin_dir = '/usr/hdp/current/hadoop-client/bin',
        keytab = UnknownConfigurationMock(),
        kinit_path_local = '/usr/bin/kinit',
        user = UnknownConfigurationMock(),
        action = ['execute'],
        hadoop_conf_dir = '/usr/hdp/current/hadoop-client/conf',
    )
    self.assertResourceCalled('PropertiesFile', '/usr/hdp/current/spark-client/conf/spark-defaults.conf',
        key_value_delimiter = ' ',
        properties = self.getConfig()['configurations']['spark-defaults'],
    )
    self.assertResourceCalled('File', '/usr/hdp/current/spark-client/conf/spark-env.sh',
        content = InlineTemplate(self.getConfig()['configurations']['spark-env']['content']),
        owner = 'spark',
        group = 'spark',
    )
    self.assertResourceCalled('File', '/usr/hdp/current/spark-client/conf/log4j.properties',
        content = '\n# Set everything to be logged to the console\nlog4j.rootCategory=INFO, console\nlog4j.appender.console=org.apache.log4j.ConsoleAppender\nlog4j.appender.console.target=System.err\nlog4j.appender.console.layout=org.apache.log4j.PatternLayout\nlog4j.appender.console.layout.ConversionPattern=%d{yy/MM/dd HH:mm:ss} %p %c{1}: %m%n\n\n# Settings to quiet third party logs that are too verbose\nlog4j.logger.org.eclipse.jetty=WARN\nlog4j.logger.org.eclipse.jetty.util.component.AbstractLifeCycle=ERROR\nlog4j.logger.org.apache.spark.repl.SparkIMain$exprTyper=INFO\nlog4j.logger.org.apache.spark.repl.SparkILoop$SparkILoopInterpreter=INFO',
        owner = 'spark',
        group = 'spark',
    )
    self.assertResourceCalled('File', '/usr/hdp/current/spark-client/conf/metrics.properties',
        content = InlineTemplate(self.getConfig()['configurations']['spark-metrics-properties']['content']),
        owner = 'spark',
        group = 'spark',
    )
    self.assertResourceCalled('File', '/usr/hdp/current/spark-client/conf/java-opts',
        content = '  -Dhdp.version=2.3.0.0-1597',
        owner = 'spark',
        group = 'spark',
    )

  def test_pre_rolling_restart_23(self):
    config_file = self.get_src_folder()+"/test/python/stacks/2.2/configs/default.json"
    with open(config_file, "r") as f:
      json_content = json.load(f)
    version = '2.3.0.0-1234'
    json_content['commandParams']['version'] = version

    mocks_dict = {}
    self.executeScript(self.COMMON_SERVICES_PACKAGE_DIR + "/scripts/job_history_server.py",
                       classname = "JobHistoryServer",
                       command = "pre_rolling_restart",
                       config_dict = json_content,
                       hdp_stack_version = self.STACK_VERSION,
                       target = RMFTestCase.TARGET_COMMON_SERVICES,
                       call_mocks = [(0, None), (0, None)],
                       mocks_dict = mocks_dict)

    self.assertResourceCalled('Execute', 'hdp-select set spark-historyserver {0}'.format(version))
    self.assertResourceCalled('HdfsResource', 'hdfs:///hdp/apps/2.2.0.0/tez//tez.tar.gz',
        security_enabled = False,
        hadoop_conf_dir = '/usr/hdp/current/hadoop-client/conf',
        keytab = UnknownConfigurationMock(),
        source = '/usr/hdp/current/tez-client/lib/tez.tar.gz',
        kinit_path_local = '/usr/bin/kinit',
        user = 'hdfs',
        owner = 'hdfs',
        group = 'hadoop',
        hadoop_bin_dir = '/usr/hdp/current/hadoop-client/bin',
        type = 'file',
        action = ['create_on_execute'],
    )
    self.assertResourceCalled('HdfsResource', None,
        security_enabled = False,
        hadoop_bin_dir = '/usr/hdp/current/hadoop-client/bin',
        keytab = UnknownConfigurationMock(),
        kinit_path_local = '/usr/bin/kinit',
        user = 'hdfs',
        action = ['execute'],
        hadoop_conf_dir = '/usr/hdp/current/hadoop-client/conf',
    )
    self.assertNoMoreResources()

    self.assertEquals(2, mocks_dict['call'].call_count)
    self.assertEquals(
      "conf-select create-conf-dir --package spark --stack-version 2.3.0.0-1234 --conf-version 0",
       mocks_dict['call'].call_args_list[0][0][0])
    self.assertEquals(
      "conf-select set-conf-dir --package spark --stack-version 2.3.0.0-1234 --conf-version 0",
       mocks_dict['call'].call_args_list[1][0][0])
