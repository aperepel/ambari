/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var App = require('app');
/**
 * By Step 7, we have the following information stored in App.db and set on this
 * controller by the router.
 *
 *   selectedServices: App.db.selectedServices (the services that the user selected in Step 4)
 *   masterComponentHosts: App.db.masterComponentHosts (master-components-to-hosts mapping the user selected in Step 5)
 *   slaveComponentHosts: App.db.slaveComponentHosts (slave-components-to-hosts mapping the user selected in Step 6)
 *
 */

App.WizardStep7Controller = Em.Controller.extend(App.ServerValidatorMixin, App.EnhancedConfigsMixin, {

  name: 'wizardStep7Controller',

  /**
   * Contains all field properties that are viewed in this step
   * @type {object[]}
   */
  stepConfigs: [],

  selectedService: null,

  slaveHostToGroup: null,

  addMiscTabToPage: true,

  /**
   * Is Submit-click processing now
   * @type {bool}
   */
  submitButtonClicked: false,

  isRecommendedLoaded: false,
  /**
   * used in services_config.js view to mark a config with security icon
   */
  secureConfigs: require('data/HDP2/secure_mapping'),

  /**
   * config categories with secure properties
   * use only for add service wizard when security is enabled;
   */
  secureServices: function () {
    return $.extend(true, [], require('data/HDP2/secure_configs'));
  }.property(),

  /**
   * uses for add service - find out is security is enabled
   */
  securityEnabled: function () {
    return App.router.get('mainAdminKerberosController.securityEnabled');
  }.property('App.router.mainAdminKerberosController.securityEnabled'),

  /**
   * If configChangeObserver Modal is shown
   * @type {bool}
   */
  miscModalVisible: false,

  overrideToAdd: null,

  /**
   * Is installer controller used
   * @type {bool}
   */
  isInstaller: true,

  /**
   * List of config groups
   * @type {object[]}
   */
  configGroups: [],

  /**
   * List of config group to be deleted
   * @type {object[]}
   */
  groupsToDelete: [],

  preSelectedConfigGroup: null,

  /**
   * Currently selected config group
   * @type {object}
   */
  selectedConfigGroup: null,

  /**
   * Config tags of actually installed services
   * @type {array}
   */
  serviceConfigTags: [],

  /**
   * Are advanced configs loaded
   * @type {bool}
   */
  isAdvancedConfigLoaded: true,

  /**
   * Are applied to service configs loaded
   * @type {bool}
   */
  isAppliedConfigLoaded: true,

  isConfigsLoaded: function () {
    return (this.get('isAdvancedConfigLoaded') && this.get('isAppliedConfigLoaded'));
  }.property('isAdvancedConfigLoaded', 'isAppliedConfigLoaded'),

  /**
   * Number of errors in the configs in the selected service
   * @type {number}
   */
  errorsCount: function () {
    return this.get('selectedService.configs').filter(function (config) {
      return Em.isNone(config.get('widget'));
    }).filter(function(config) {
      return !config.get('isValid') || (config.get('overrides') || []).someProperty('isValid', false);
    }).filterProperty('isVisible').length;
  }.property('selectedService.configs.@each.isValid', 'selectedService.configs.@each.overrideErrorTrigger'),

  /**
   * Should Next-button be disabled
   * @type {bool}
   */
  isSubmitDisabled: function () {
    if (!this.get('stepConfigs.length')) return true;
    if (this.get('submitButtonClicked')) return true;
    return (!this.get('stepConfigs').filterProperty('showConfig', true).everyProperty('errorCount', 0) || this.get("miscModalVisible"));
  }.property('stepConfigs.@each.errorCount', 'miscModalVisible', 'submitButtonClicked'),

  /**
   * List of selected to install service names
   * @type {string[]}
   */
  selectedServiceNames: function () {
    return this.get('content.services').filterProperty('isSelected', true).filterProperty('isInstalled', false).mapProperty('serviceName');
  }.property('content.services', 'content.services.@each.isSelected', 'content.services.@each.isInstalled', 'content.stacks.@each.isSelected').cacheable(),

  /**
   * List of installed and selected to install service names
   * @type {string[]}
   */
  allSelectedServiceNames: function () {
    return this.get('content.services').filter(function (service) {
      return service.get('isInstalled') || service.get('isSelected');
    }).mapProperty('serviceName');
  }.property('content.services', 'content.services.@each.isSelected', 'content.services.@each.isInstalled', 'content.stacks.@each.isSelected').cacheable(),

  /**
   * List of installed service names
   * @type {string[]}
   */
  installedServiceNames: function () {
    var serviceNames = this.get('content.services').filterProperty('isInstalled').mapProperty('serviceName');
    if (this.get('content.controllerName') !== 'installerController') {
      serviceNames = serviceNames.filter(function (_serviceName) {
        return !App.get('services.noConfigTypes').contains(_serviceName);
      });
    }
    return serviceNames;
  }.property('content.services').cacheable(),

  /**
   * List of master components
   * @type {Ember.Enumerable}
   */
  masterComponentHosts: function () {
    return this.get('content.masterComponentHosts');
  }.property('content.masterComponentHosts'),

  /**
   * List of slave components
   * @type {Ember.Enumerable}
   */
  slaveComponentHosts: function () {
    return this.get('content.slaveGroupProperties');
  }.property('content.slaveGroupProperties', 'content.slaveComponentHosts'),

  customData: [],

  /**
   * Filter text will be located here
   * @type {string}
   */
  filter: '',

  /**
   * List of filters for config properties to populate filter combobox
   */
  propertyFilters: [
    {
      attributeName: 'isOverridden',
      attributeValue: true,
      caption: 'common.combobox.dropdown.overridden'
    },
    {
      attributeName: 'isFinal',
      attributeValue: true,
      caption: 'common.combobox.dropdown.final'
    },
    {
      attributeName: 'hasIssues',
      attributeValue: true,
      caption: 'common.combobox.dropdown.issues'
    }
  ],

  issuesFilterText: function () {
    return (this.get('isSubmitDisabled') && !this.get('submitButtonClicked') &&
      this.get('filterColumns').findProperty('attributeName', 'hasIssues').get('selected')) ?
        Em.I18n.t('installer.step7.showingPropertiesWithIssues') : '';
  }.property('isSubmitDisabled', 'submitButtonClicked', 'filterColumns.@each.selected'),

  issuesFilterLinkText: function () {
    if (this.get('filterColumns').findProperty('attributeName', 'hasIssues').get('selected')) {
      return Em.I18n.t('installer.step7.showAllProperties');
    }

    return (this.get('isSubmitDisabled') && !this.get('submitButtonClicked')) ?
      (
        this.get('filterColumns').findProperty('attributeName', 'hasIssues').get('selected') ?
          Em.I18n.t('installer.step7.showAllProperties') : Em.I18n.t('installer.step7.showPropertiesWithIssues')
      ) : '';
  }.property('isSubmitDisabled', 'submitButtonClicked', 'filterColumns.@each.selected'),

  /**
   * Dropdown menu items in filter combobox
   */
  filterColumns: function () {
    return this.get('propertyFilters').map(function (filter) {
      return Ember.Object.create({
        attributeName: filter.attributeName,
        attributeValue: filter.attributeValue,
        name: this.t(filter.caption),
        selected: false
      });
    }, this);
  }.property('propertyFilters'),

  /**
   * Clear controller's properties:
   *  <ul>
   *    <li>stepConfigs</li>
   *    <li>filter</li>
   *  </ul>
   *  and desect all <code>filterColumns</code>
   * @method clearStep
   */
  clearStep: function () {
    this.setProperties({
      configValidationGlobalMessage: [],
      submitButtonClicked: false,
      isSubmitDisabled: true,
      isRecommendedLoaded: false
    });
    this.get('stepConfigs').clear();
    this.set('filter', '');
    this.get('filterColumns').setEach('selected', false);
  },

  /**
   * Load config groups for installed services
   * One ajax-request for each service
   * @param {string[]} servicesNames
   * @method loadInstalledServicesConfigGroups
   */
  loadInstalledServicesConfigGroups: function (servicesNames) {
    servicesNames.forEach(function (serviceName) {
      App.ajax.send({
        name: 'config.tags_and_groups',
        sender: this,
        data: {
          serviceName: serviceName,
          serviceConfigsDef: App.config.get('preDefinedServiceConfigs').findProperty('serviceName', serviceName)
        },
        success: 'loadServiceTagsSuccess'
      });
    }, this);
  },

  /**
   * Create site to tag map. Format:
   * <code>
   *   {
   *    site1: tag1,
   *    site1: tag2,
   *    site2: tag3
   *    ...
   *   }
   * </code>
   * @param {object} desired_configs
   * @param {string[]} sites
   * @returns {object}
   * @private
   * @method _createSiteToTagMap
   */
  _createSiteToTagMap: function (desired_configs, sites) {
    var siteToTagMap = {};
    for (var site in desired_configs) {
      if (desired_configs.hasOwnProperty(site)) {
        if (!!sites[site]) {
          siteToTagMap[site] = desired_configs[site].tag;
        }
      }
    }
    return siteToTagMap;
  },

  /**
   * Load config groups success callback
   * @param {object} data
   * @param {object} opt
   * @param {object} params
   * @method loadServiceTagsSuccess
   */
  loadServiceTagsSuccess: function (data, opt, params) {
    var serviceName = params.serviceName,
      service = this.get('stepConfigs').findProperty('serviceName', serviceName),
      defaultConfigGroupHosts = this.get('wizardController.allHosts').mapProperty('hostName'),
      siteToTagMap = this._createSiteToTagMap(data.Clusters.desired_configs, params.serviceConfigsDef.get('configTypes')),
      selectedConfigGroup;
    this.set('loadedClusterSiteToTagMap', siteToTagMap);

    //parse loaded config groups
    var configGroups = [];
    if (data.config_groups.length) {
      data.config_groups.forEach(function (item) {
        item = item.ConfigGroup;
        if (item.tag === serviceName) {
          var groupHosts = item.hosts.mapProperty('host_name');
          var newConfigGroup = App.ConfigGroup.create({
            id: item.id,
            name: item.group_name,
            description: item.description,
            isDefault: false,
            parentConfigGroup: null,
            service: App.Service.find().findProperty('serviceName', item.tag),
            hosts: groupHosts,
            configSiteTags: []
          });
          groupHosts.forEach(function (host) {
            defaultConfigGroupHosts = defaultConfigGroupHosts.without(host);
          }, this);
          item.desired_configs.forEach(function (config) {
            newConfigGroup.configSiteTags.push(App.ConfigSiteTag.create({
              site: config.type,
              tag: config.tag
            }));
          }, this);
          configGroups.push(newConfigGroup);
        }
      }, this);
    }
    var defaultConfigGroup = App.ConfigGroup.create({
      name: App.format.role(serviceName) + " Default",
      description: "Default cluster level " + serviceName + " configuration",
      isDefault: true,
      hosts: defaultConfigGroupHosts,
      parentConfigGroup: null,
      service: Em.Object.create({
        id: serviceName
      }),
      serviceName: serviceName,
      configSiteTags: []
    });
    if (!selectedConfigGroup) {
      selectedConfigGroup = defaultConfigGroup;
    }
    configGroups = configGroups.sortProperty('name');
    configGroups.unshift(defaultConfigGroup);
    service.set('configGroups', configGroups);
    var loadedGroupToOverrideSiteToTagMap = {};
    var configGroupsWithOverrides = selectedConfigGroup.get('isDefault') ? service.get('configGroups') : [selectedConfigGroup];
    configGroupsWithOverrides.forEach(function (item) {
      var groupName = item.get('name');
      loadedGroupToOverrideSiteToTagMap[groupName] = {};
      item.get('configSiteTags').forEach(function (siteTag) {
        var site = siteTag.get('site');
        loadedGroupToOverrideSiteToTagMap[groupName][site] = siteTag.get('tag');
      }, this);
    }, this);
    this.set('preSelectedConfigGroup', selectedConfigGroup);
    App.config.loadServiceConfigGroupOverrides(service.get('configs'), loadedGroupToOverrideSiteToTagMap, service.get('configGroups'), this.onLoadOverrides, this);
  },

  onLoadOverrides: function (configs) {
    var serviceName = configs[0].serviceName,
      service = this.get('stepConfigs').findProperty('serviceName', serviceName);
    var serviceConfig = App.config.createServiceConfig(serviceName);
    if (serviceConfig.get('serviceName') === 'HDFS') {
      App.config.OnNnHAHideSnn(serviceConfig);
    }
    service.set('selectedConfigGroup', this.get('preSelectedConfigGroup'));
    this.loadComponentConfigs(service.get('configs'), serviceConfig, service);
    service.set('configs', serviceConfig.get('configs'));
  },

  /**
   * Set <code>isEditable</code>-property to <code>serviceConfigProperty</code>
   * Based on user's permissions and selected config group
   * @param {Ember.Object} serviceConfigProperty
   * @param {bool} defaultGroupSelected
   * @returns {Ember.Object} Updated config-object
   * @method _updateIsEditableFlagForConfig
   */
  _updateIsEditableFlagForConfig: function (serviceConfigProperty, defaultGroupSelected) {
    if (App.isAccessible('ADMIN')) {
      if (defaultGroupSelected && !this.get('isHostsConfigsPage') && !Em.get(serviceConfigProperty, 'group')) {
        serviceConfigProperty.set('isEditable', serviceConfigProperty.get('isReconfigurable'));
      } else if (Em.get(serviceConfigProperty, 'group') && Em.get(serviceConfigProperty, 'group.name') == this.get('selectedConfigGroup.name')) {
        serviceConfigProperty.set('isEditable', true);
      } else {
        serviceConfigProperty.set('isEditable', false);
      }
    }
    else {
      serviceConfigProperty.set('isEditable', false);
    }
    return serviceConfigProperty;
  },

  /**
   * Set <code>overrides</code>-property to <code>serviceConfigProperty<code>
   * @param {Ember.Object} serviceConfigProperty
   * @param {Ember.Object} component
   * @return {Ember.Object} Updated config-object
   * @method _updateOverridesForConfig
   */
  _updateOverridesForConfig: function (serviceConfigProperty, component) {

    var overrides = serviceConfigProperty.get('overrides');

    if (Em.isNone(overrides)) {
      serviceConfigProperty.set('overrides', Em.A([]));
      return serviceConfigProperty;
    }
    serviceConfigProperty.set('overrides', null);
    var defaultGroupSelected = component.get('selectedConfigGroup.isDefault');

    // Wrap each override to App.ServiceConfigProperty
    overrides.forEach(function (override) {
      var newSCP = App.ServiceConfigProperty.create(serviceConfigProperty);
      newSCP.set('value', override.value);
      newSCP.set('isOriginalSCP', false); // indicated this is overridden value,
      newSCP.set('parentSCP', serviceConfigProperty);
      if (defaultGroupSelected) {
        var group = component.get('configGroups').findProperty('name', override.group.get('name'));
        // prevent cycle in proto object, clean link
        if (group.get('properties').length == 0) {
          group.set('properties', Em.A([]));
        }
        group.get('properties').push(newSCP);
        newSCP.set('group', override.group);
        newSCP.set('isEditable', false);
      }
      var parentOverridesArray = serviceConfigProperty.get('overrides');
      if (Em.isNone(parentOverridesArray)) {
        parentOverridesArray = Em.A([]);
        serviceConfigProperty.set('overrides', parentOverridesArray);
      }
      serviceConfigProperty.get('overrides').pushObject(newSCP);
      newSCP.validate();
    }, this);
    return serviceConfigProperty;
  },

  /**
   * Set configs with overrides, recommended defaults to component
   * @param {Ember.Object[]} configs
   * @param {Ember.Object} componentConfig
   * @param {Ember.Object} component
   * @method loadComponentConfigs
   */
  loadComponentConfigs: function (configs, componentConfig, component) {
    var defaultGroupSelected = component.get('selectedConfigGroup.isDefault');

    configs.forEach(function (serviceConfigProperty) {
      if (!serviceConfigProperty) return;

      if (Em.isNone(serviceConfigProperty.get('isOverridable'))) {
        serviceConfigProperty.set('isOverridable', true);
      }
      this._updateOverridesForConfig(serviceConfigProperty, component);
      this._updateIsEditableFlagForConfig(serviceConfigProperty, defaultGroupSelected);

      componentConfig.get('configs').pushObject(serviceConfigProperty);
      serviceConfigProperty.validate();

    }, this);
    component.get('configGroups').filterProperty('isDefault', false).forEach(function (configGroup) {
      configGroup.set('hash', this.get('wizardController').getConfigGroupHash(configGroup));
    }, this);
    var overrideToAdd = this.get('overrideToAdd');
    if (overrideToAdd) {
      overrideToAdd = componentConfig.get('configs').findProperty('name', overrideToAdd.name);
      if (overrideToAdd) {
        this.addOverrideProperty(overrideToAdd);
        component.set('overrideToAdd', null);
      }
    }
  },

  /**
   *  Resolve dependency between configs.
   *  @param serviceName {String}
   *  @param configs {Ember.Enumerable}
   */
  resolveServiceDependencyConfigs: function (serviceName, configs) {
    switch (serviceName) {
      case 'STORM':
        this.resolveStormConfigs(configs);
        break;
      case 'YARN':
        this.resolveYarnConfigs(configs);
        break;
    }
  },

  /**
   * Update some Storm configs
   * If Ganglia is selected to install or already installed, Ganglia host should be added to configs
   * @param {Ember.Enumerable} configs
   * @method resolveStormConfigs
   */
  resolveStormConfigs: function (configs) {
    var dependentConfigs, gangliaServerHost, gangliaHostId, hosts;
    dependentConfigs = ['nimbus.childopts', 'supervisor.childopts', 'worker.childopts'];
    // if Ganglia selected or installed, set ganglia host to configs
    if (this.get('installedServiceNames').contains('STORM') && this.get('installedServiceNames').contains('GANGLIA')) return;
    if (this.get('allSelectedServiceNames').contains('GANGLIA') || this.get('installedServiceNames').contains('GANGLIA')) {
      if (this.get('wizardController.name') === 'addServiceController') {
        gangliaServerHost = this.get('wizardController').getDBProperty('masterComponentHosts').findProperty('component', 'GANGLIA_SERVER').hostName;
      } else {
        hosts = this.get('wizardController').getDBProperty('hosts');
        gangliaHostId = this.get('wizardController').getDBProperty('masterComponentHosts').findProperty('component', 'GANGLIA_SERVER').host_id;
        for (var hostName in hosts) {
          if (hosts[hostName].id == gangliaHostId) gangliaServerHost = hosts[hostName].name;
        }
      }
      dependentConfigs.forEach(function (configName) {
        var config = configs.findProperty('name', configName);
        if (!Em.isNone(config.value)) {
          var replaceStr = config.value.match(/.jar=host[^,]+/)[0];
          var replaceWith = replaceStr.slice(0, replaceStr.lastIndexOf('=') - replaceStr.length + 1) + gangliaServerHost;
          config.value = config.recommendedValue = config.value.replace(replaceStr, replaceWith);
        }
      }, this);
    }
  },

  /**
   * Update some Storm configs
   * If SLIDER is selected to install or already installed,
   * some Yarn properties must be changed
   * @param {Ember.Enumerable} configs
   * @method resolveYarnConfigs
   */
  resolveYarnConfigs: function (configs) {
    var cfgToChange = configs.findProperty('name', 'hadoop.registry.rm.enabled');
    if (cfgToChange) {
      var res = this.get('allSelectedServiceNames').contains('SLIDER');
      if (Em.get(cfgToChange, 'value') !== res) {
        Em.set(cfgToChange, 'recommendedValue', res);
        Em.set(cfgToChange, 'value', res);
      }
    }
  },

  /**
   * On load function
   * @method loadStep
   */
  loadStep: function () {
    console.log("TRACE: Loading step7: Configure Services");
    if (!this.get('isConfigsLoaded')) {
      return;
    }
    this.clearStep();

    var self = this;
    //STEP 1: Load advanced configs
    var advancedConfigs = this.get('content.advancedServiceConfig');
    //STEP 2: Load on-site configs by service from local DB
    var storedConfigs = this.get('content.serviceConfigProperties');
    //STEP 3: Merge pre-defined configs with loaded on-site configs
    var configs = App.config.mergePreDefinedWithStored(
      storedConfigs,
      advancedConfigs,
      this.get('selectedServiceNames').concat(this.get('installedServiceNames'))
    );
    App.config.setPreDefinedServiceConfigs(this.get('addMiscTabToPage'));
    //STEP 4: Add advanced configs
    App.config.addAdvancedConfigs(configs, advancedConfigs);

    this.set('groupsToDelete', this.get('wizardController').getDBProperty('groupsToDelete') || []);

    if (this.get('wizardController.name') === 'addServiceController') {
      App.router.get('configurationController').getConfigsByTags(this.get('serviceConfigTags')).done(function (loadedConfigs) {
        self.setInstalledServiceConfigs(self.get('serviceConfigTags'), configs, loadedConfigs, self.get('installedServiceNames'));
        self.applyServicesConfigs(configs, storedConfigs);
      });
    } else {
      this.applyServicesConfigs(configs, storedConfigs);
    }
  },

  applyServicesConfigs: function (configs, storedConfigs) {
    if (this.get('allSelectedServiceNames').contains('YARN')) {
      configs = App.config.fileConfigsIntoTextarea(configs, 'capacity-scheduler.xml', []);
    }
    var dependedServices = ["STORM", "YARN"];
    dependedServices.forEach(function (serviceName) {
      if (this.get('allSelectedServiceNames').contains(serviceName)) {
        this.resolveServiceDependencyConfigs(serviceName, configs);
      }
    }, this);
    //STEP 6: Distribute configs by service and wrap each one in App.ServiceConfigProperty (configs -> serviceConfigs)
    var self = this;
    if (self.get('securityEnabled') && self.get('wizardController.name') == 'addServiceController') {
      self.addKerberosDescriptorConfigs(configs, self.get('wizardController.kerberosDescriptorConfigs') || []);
    }
    self.setStepConfigs(configs, storedConfigs);
    this.loadServerSideConfigsRecommendations().always(function () {
      // format descriptor configs
      var serviceConfigProperties = (self.get('content.serviceConfigProperties') || []).mapProperty('name');
      var recommendedToDelete = self.get('_dependentConfigValues').filterProperty('toDelete');
      recommendedToDelete.forEach(function (c) {
        var name = Em.get(c, 'propertyName');
        if (serviceConfigProperties.contains(name)) {
          Em.set(self.get('_dependentConfigValues').findProperty('propertyName', name), 'toDelete', false);
        }
      });

      self.updateDependentConfigs();
      self.checkHostOverrideInstaller();
      self.activateSpecialConfigs();
      self.selectProperService();
      self.restoreRecommendedConfigs();
      self.clearDependentConfigsByService(App.StackService.find().filterProperty('isSelected').mapProperty('serviceName'));
      self.set('isRecommendedLoaded', true);
      if (self.get('content.skipConfigStep')) {
        App.router.send('next');
      }
    });
  },

  /**
   * After user navigates back to step7, values for depended configs should be set to values set by user and not to default values
   * @method restoreRecommendedConfigs
   */
  restoreRecommendedConfigs: function () {
    var recommendationsConfigs = this.get('recommendationsConfigs') || {};
    var serviceConfigProperties = this.get('content.serviceConfigProperties') || [];
    var stepConfigs = this.get('stepConfigs');
    Em.keys(recommendationsConfigs).forEach(function (file) {
      (Em.keys(recommendationsConfigs[file].properties).concat(Em.keys(recommendationsConfigs[file].property_attributes || {}))).forEach(function (configName) {
        stepConfigs.forEach(function (stepConfig) {
          stepConfig.get('configs').filterProperty('name', configName).forEach(function (configProperty) {
            if (Em.get(configProperty, 'filename').contains(file)) {
              var scps = serviceConfigProperties.filterProperty('name', configName).filter(function (cp) {
                return Em.get(cp, 'filename').contains(file);
              });
              if (scps.length) {
                Em.set(configProperty, 'value', Em.get(scps[0], 'value'));
              }
            }
          });
        });
      });
    });
  },

  /**
   * Mark descriptor properties in configuration object.
   *
   * @param {Object[]} configs - config properties to change
   * @param {App.ServiceConfigProperty[]} descriptor - parsed kerberos descriptor
   * @method addKerberosDescriptorConfigs
   */
  addKerberosDescriptorConfigs: function (configs, descriptor) {
    descriptor.forEach(function (item) {
      var property = configs.findProperty('name', item.get('name'));
      if (property) {
        Em.setProperties(property, {
          isSecureConfig: true,
          displayName: Em.get(item, 'name'),
          isUserProperty: false,
          isOverridable: false,
          category: 'Advanced ' + Em.get(item, 'filename')
        });
      }
    });
  },

  /**
   * Load config groups
   * and (if some services are already installed) load config groups for installed services
   * @method checkHostOverrideInstaller
   */
  checkHostOverrideInstaller: function () {
    if (this.get('wizardController.name') !== 'kerberosWizardController') {
      this.loadConfigGroups(this.get('content.configGroups'));
    }
    if (this.get('installedServiceNames').length > 0) {
      this.loadInstalledServicesConfigGroups(this.get('installedServiceNames'));
    }
  },

  /**
   * Set init <code>stepConfigs</code> value
   * Set <code>selected</code> for addable services if addServiceController is used
   * Remove SNameNode if HA is enabled (and if addServiceController is used)
   * @param {Ember.Object[]} configs
   * @param {Ember.Object[]} storedConfigs
   * @method setStepConfigs
   */
  setStepConfigs: function (configs, storedConfigs) {
    var localDB = {
      hosts: this.get('wizardController.content.hosts'),
      masterComponentHosts: this.get('wizardController.content.masterComponentHosts'),
      slaveComponentHosts: this.get('wizardController.content.slaveComponentHosts')
    };
    var serviceConfigs = App.config.renderConfigs(configs, storedConfigs, this.get('allSelectedServiceNames'), this.get('installedServiceNames'), localDB);
    if (this.get('wizardController.name') === 'addServiceController') {
      serviceConfigs.setEach('showConfig', true);
      serviceConfigs.setEach('selected', false);
      this.get('selectedServiceNames').forEach(function (serviceName) {
        if (!serviceConfigs.findProperty('serviceName', serviceName)) return;
        serviceConfigs.findProperty('serviceName', serviceName).set('selected', true);
      }, this);
      this.get('installedServiceNames').forEach(function (serviceName) {
        var serviceConfigObj = serviceConfigs.findProperty('serviceName', serviceName);
        var isInstallableService = App.StackService.find(serviceName).get('isInstallable');
        if (!isInstallableService) serviceConfigObj.set('showConfig', false);
      }, this);
      // if HA is enabled -> Remove SNameNode, hbase.rootdir should use Name Service ID
      if (App.get('isHaEnabled')) {
        var c = serviceConfigs.findProperty('serviceName', 'HDFS').configs,
          nameServiceId = c.findProperty('name', 'dfs.nameservices'),
          removedConfigs = c.filterProperty('category', 'SECONDARY_NAMENODE');
        removedConfigs.map(function (config) {
          c = c.without(config);
        });
        serviceConfigs.findProperty('serviceName', 'HDFS').configs = c;

        if(this.get('selectedServiceNames').contains('HBASE') && nameServiceId){
          var hRootDir = serviceConfigs.findProperty('serviceName', 'HBASE').configs.findProperty('name','hbase.rootdir'),
            valueToChange = hRootDir.get('value').replace(/\/\/.*:/i, '//' + nameServiceId.get('value') + ':');

          hRootDir.setProperties({
            'value':  valueToChange,
            'recommendedValue' : valueToChange
          });
        }
      }
    }

    // Remove Notifications from MISC if it isn't Installer Controller
    if (this.get('wizardController.name') !== 'installerController') {
      var miscService = serviceConfigs.findProperty('serviceName', 'MISC');
      if (miscService) {
        c = miscService.configs;
        removedConfigs = c.filterProperty('category', 'Notifications');
        removedConfigs.map(function (config) {
          c = c.without(config);
        });
        miscService.configs = c;
      }
    }

    this.set('stepConfigs', serviceConfigs);
  },

  /**
   * Select first addable service for <code>addServiceWizard</code>
   * Select first service at all in other cases
   * @method selectProperService
   */
  selectProperService: function () {
    if (this.get('wizardController.name') === 'addServiceController') {
      this.set('selectedService', this.get('stepConfigs').filterProperty('selected', true).get('firstObject'));
    } else {
      this.set('selectedService', this.get('stepConfigs').filterProperty('showConfig', true).objectAt(0));
    }
  },

  /**
   * Load config tags
   * @return {$.ajax|null}
   * @method getConfigTags
   */
  getConfigTags: function () {
    this.set('isAppliedConfigLoaded', false);
    return App.ajax.send({
      name: 'config.tags',
      sender: this,
      success: 'getConfigTagsSuccess'
    });
  },

  /**
   * Success callback for config tags request
   * Updates <code>serviceConfigTags</code> with tags received from server
   * @param {object} data
   * @method getConfigTagsSuccess
   */
  getConfigTagsSuccess: function (data) {
    var installedServiceSites = [];
    App.StackService.find().filterProperty('isInstalled').forEach(function (service) {
      if (!service.get('configTypes')) return;
      var configTypes = Object.keys(service.get('configTypes'));
      installedServiceSites = installedServiceSites.concat(configTypes);
    }, this);
    installedServiceSites = installedServiceSites.uniq();
    var serviceConfigTags = [];
    for (var site in data.Clusters.desired_configs) {
      if (data.Clusters.desired_configs.hasOwnProperty(site)) {
        if (installedServiceSites.contains(site)) {
          serviceConfigTags.push({
            siteName: site,
            tagName: data.Clusters.desired_configs[site].tag,
            newTagName: null
          });
        }
      }
    }
    this.set('serviceConfigTags', serviceConfigTags);
    this.set('isAppliedConfigLoaded', true);
  },

  /**
   * set configs actual values from server
   * @param serviceConfigTags
   * @param configs
   * @param configsByTags
   * @param installedServiceNames
   * @method setInstalledServiceConfigs
   */
  setInstalledServiceConfigs: function (serviceConfigTags, configs, configsByTags, installedServiceNames) {
    var configsMap = {};
    var configMixin = App.get('config');
    var nonServiceTab = require('data/service_configs');
    var self = this;

    configsByTags.forEach(function (configSite) {
      configsMap[configSite.type] = configSite.properties || {};
    });
    configs.forEach(function (_config) {
      var type = _config.filename ? App.config.getConfigTagFromFileName(_config.filename) : null;
      var mappedConfigValue = type && configsMap[type] ? configsMap[type][_config.name] : null;
      if (!Em.isNone(mappedConfigValue) && ((installedServiceNames && installedServiceNames.contains(_config.serviceName) || nonServiceTab.someProperty('serviceName', _config.serviceName)))) {
        // prevent overriding already edited properties
        if (_config.savedValue != mappedConfigValue) {
          _config.value = mappedConfigValue;
        }
        _config.savedValue = mappedConfigValue;
        _config.hasInitialValue = true;
        App.config.handleSpecialProperties(_config);
        delete configsMap[type][_config.name];
      }
    });
    self.setServiceDatabaseConfigs(configs);
    //add user properties

    Em.keys(configsMap).forEach(function (filename) {
      Em.keys(configsMap[filename]).forEach(function (propertyName) {
        configs.push(configMixin.addUserProperty({
          id: 'site property',
          name: propertyName,
          serviceName: configMixin.getServiceNameByConfigType(filename),
          value: configsMap[filename][propertyName],
          savedValue: configsMap[filename][propertyName],
          filename: configMixin.get('filenameExceptions').contains(filename) ? filename : filename + '.xml',
          category: 'Advanced',
          hasInitialValue: true,
          isUserProperty: true,
          isOverridable: true,
          overrides: [],
          isRequired: true,
          isVisible: true,
          showLabel: true
        }, false, []));
      });
    });
  },

  /**
   * Check if Oozie or Hive use existing database then need
   * to restore missed properties
   *
   * @param {Object[]} configs
   **/
  setServiceDatabaseConfigs: function (configs) {
    var serviceNames = this.get('installedServiceNames').filter(function (serviceName) {
      return ['OOZIE', 'HIVE'].contains(serviceName);
    });
    serviceNames.forEach(function (serviceName) {
      var propertyPrefix = serviceName.toLowerCase();
      var dbTypeConfig = configs.findProperty('name', propertyPrefix + '_database');
      if (!/existing/gi.test(dbTypeConfig.value)) return;
      var dbHostName = propertyPrefix + '_hostname';
      var database = dbTypeConfig.value.match(/MySQL|PostgreSQL|Oracle|Derby|MSSQL/gi)[0];
      var dbPrefix = database.toLowerCase();
      if (database.toLowerCase() == 'mssql') {
        if (/integrated/gi.test(dbTypeConfig.value)) {
          dbPrefix = 'mssql_server_2';
        } else {
          dbPrefix = 'mssql_server';
        }
      }
      var propertyName = propertyPrefix + '_existing_' + dbPrefix + '_host';
      var existingDBConfig = configs.findProperty('name', propertyName);
      if (!existingDBConfig.value)
        existingDBConfig.value = existingDBConfig.savedValue = configs.findProperty('name', dbHostName).value;
    }, this);
  },
  /**
   * Add group ids to <code>groupsToDelete</code>
   * Also save <code>groupsToDelete</code> to local storage
   * @param {Ember.Object[]} groups
   * @method setGroupsToDelete
   */
  setGroupsToDelete: function (groups) {
    var groupsToDelete = this.get('groupsToDelete');
    groups.forEach(function (group) {
      if (group.get('id'))
        groupsToDelete.push({
          id: group.get('id')
        });
    });
    this.get('wizardController').setDBProperty('groupsToDelete', groupsToDelete);
  },

  /**
   * Update <code>configGroups</code> with selected service configGroups
   * Also set default group to first position
   * Update <code>selectedConfigGroup</code> with new default group
   * @method selectedServiceObserver
   */
  selectedServiceObserver: function () {
    if (this.get('selectedService') && (this.get('selectedService.serviceName') !== 'MISC')) {
      var serviceGroups = this.get('selectedService.configGroups');
      serviceGroups.forEach(function (item, index, array) {
        if (item.isDefault) {
          array.unshift(item);
          array.splice(index + 1, 1);
        }
      });
      this.set('configGroups', serviceGroups);
      this.set('selectedConfigGroup', serviceGroups.findProperty('isDefault'));
    }
  }.observes('selectedService.configGroups.@each'),

  /**
   * load default groups for each service in case of initial load
   * @param serviceConfigGroups
   * @method loadConfigGroups
   */
  loadConfigGroups: function (serviceConfigGroups) {
    var services = this.get('stepConfigs');
    var hosts = this.get('wizardController.allHosts').mapProperty('hostName');
    services.forEach(function (service) {
      if (service.get('serviceName') === 'MISC') return;
      var serviceRawGroups = serviceConfigGroups.filterProperty('service.id', service.serviceName);
      if (!serviceRawGroups.length) {
        service.set('configGroups', [
          App.ConfigGroup.create({
            name: service.displayName + " Default",
            description: "Default cluster level " + service.serviceName + " configuration",
            isDefault: true,
            hosts: Em.copy(hosts),
            service: Em.Object.create({
              id: service.serviceName
            }),
            serviceName: service.serviceName
          })
        ]);
      }
      else {
        var defaultGroup = App.ConfigGroup.create(serviceRawGroups.findProperty('isDefault'));
        var serviceGroups = service.get('configGroups');
        serviceRawGroups.filterProperty('isDefault', false).forEach(function (configGroup) {
          var readyGroup = App.ConfigGroup.create(configGroup);
          var wrappedProperties = [];
          readyGroup.get('properties').forEach(function (propertyData) {
            var parentSCP = service.configs.filterProperty('filename', propertyData.filename).findProperty('name', propertyData.name);
            var overriddenSCP = App.ServiceConfigProperty.create(parentSCP);
            overriddenSCP.set('isOriginalSCP', false);
            overriddenSCP.set('parentSCP', parentSCP);
            overriddenSCP.set('group', readyGroup);
            overriddenSCP.setProperties(propertyData);
            wrappedProperties.pushObject(App.ServiceConfigProperty.create(overriddenSCP));
          });
          wrappedProperties.setEach('group', readyGroup);
          readyGroup.set('properties', wrappedProperties);
          readyGroup.set('parentConfigGroup', defaultGroup);
          serviceGroups.pushObject(readyGroup);
        });
        defaultGroup.set('childConfigGroups', serviceGroups);
        serviceGroups.pushObject(defaultGroup);
      }
    });
  },

  /**
   * Click-handler on config-group to make it selected
   * @param {object} event
   * @method selectConfigGroup
   */
  selectConfigGroup: function (event) {
    this.set('selectedConfigGroup', event.context);
  },

  /**
   * Rebuild list of configs switch of config group:
   * on default - display all configs from default group and configs from non-default groups as disabled
   * on non-default - display all from default group as disabled and configs from selected non-default group
   * @method switchConfigGroupConfigs
   */
  switchConfigGroupConfigs: function () {
    var serviceConfigs = this.get('selectedService.configs'),
      selectedGroup = this.get('selectedConfigGroup'),
      overrideToAdd = this.get('overrideToAdd'),
      overrides = [];
    if (!selectedGroup) return;

    var displayedConfigGroups = this._getDisplayedConfigGroups();
    displayedConfigGroups.forEach(function (group) {
      overrides.pushObjects(group.get('properties'));
    });
    serviceConfigs.forEach(function (config) {
      this._setEditableValue(config);
      this._setOverrides(config, overrides);
    }, this);
  }.observes('selectedConfigGroup'),

  /**
   * Get list of config groups to display
   * Returns empty array if no <code>selectedConfigGroup</code>
   * @return {Array}
   * @method _getDisplayedConfigGroups
   */
  _getDisplayedConfigGroups: function () {
    var selectedGroup = this.get('selectedConfigGroup');
    if (!selectedGroup) return [];
    return (selectedGroup.get('isDefault')) ?
      this.get('selectedService.configGroups').filterProperty('isDefault', false) :
      [this.get('selectedConfigGroup')];
  },

  /**
   * Set <code>isEditable</code> property to <code>config</code>
   * @param {Ember.Object} config
   * @return {Ember.Object} updated config-object
   * @method _setEditableValue
   */
  _setEditableValue: function (config) {
    var selectedGroup = this.get('selectedConfigGroup');
    if (!selectedGroup) return config;
    var isEditable = config.get('isEditable'),
      isServiceInstalled = this.get('installedServiceNames').contains(this.get('selectedService.serviceName'));
    if (isServiceInstalled) {
      isEditable = (!isEditable && !config.get('isReconfigurable')) ? false : selectedGroup.get('isDefault');
    }
    else {
      isEditable = selectedGroup.get('isDefault');
    }
    if (config.get('group')) {
      isEditable = config.get('group.name') == this.get('selectedConfigGroup.name');
    }
    config.set('isEditable', isEditable);
    return config;
  },

  /**
   * Set <code>overrides</code> property to <code>config</code>
   * @param {Ember.Object} config
   * @param {Ember.Enumerable} overrides
   * @returns {Ember.Object}
   * @method _setOverrides
   */
  _setOverrides: function (config, overrides) {
    var selectedGroup = this.get('selectedConfigGroup'),
      overrideToAdd = this.get('overrideToAdd'),
      configOverrides = overrides.filterProperty('name', config.get('name'));
    if (!selectedGroup) return config;
    if (overrideToAdd && overrideToAdd.get('name') === config.get('name')) {
      configOverrides.push(this.addOverrideProperty(config));
      this.set('overrideToAdd', null);
    }
    configOverrides.setEach('isEditable', !selectedGroup.get('isDefault'));
    configOverrides.setEach('parentSCP', config);
    config.set('overrides', configOverrides);
    return config;
  },

  /**
   * create overriden property and push it into Config group
   * @param {App.ServiceConfigProperty} serviceConfigProperty
   * @return {App.ServiceConfigProperty}
   * @method addOverrideProperty
   */
  addOverrideProperty: function (serviceConfigProperty) {
    var overrides = serviceConfigProperty.get('overrides') || [];
    var newSCP = App.ServiceConfigProperty.create(serviceConfigProperty);
    var group = this.get('selectedService.configGroups').findProperty('name', this.get('selectedConfigGroup.name'));
    var valueForOverride = (serviceConfigProperty.get('widget') || serviceConfigProperty.get('displayType') == 'checkbox') ? serviceConfigProperty.get('value') : '';
    newSCP.set('group', group);
    newSCP.set('value', valueForOverride);
    newSCP.set('isOriginalSCP', false); // indicated this is overridden value,
    newSCP.set('parentSCP', serviceConfigProperty);
    newSCP.set('isEditable', true);
    group.get('properties').pushObject(newSCP);
    overrides.pushObject(newSCP);
    newSCP.validate();
    return newSCP;
  },

  /**
   * @method manageConfigurationGroup
   */
  manageConfigurationGroup: function () {
    App.router.get('manageConfigGroupsController').manageConfigurationGroups(this);
  },

  /**
   * Make some configs visible depending on active services
   * @method activateSpecialConfigs
   */
  activateSpecialConfigs: function () {
    if (this.get('addMiscTabToPage')) {
      var serviceToShow = this.get('selectedServiceNames').concat('MISC');
      var miscConfigs = this.get('stepConfigs').findProperty('serviceName', 'MISC').configs;
      if (this.get('wizardController.name') == "addServiceController") {
        miscConfigs.findProperty('name', 'smokeuser').set('value', this.get('content.smokeuser')).set('isEditable', false);
        miscConfigs.findProperty('name', 'user_group').set('value', this.get('content.group')).set('isEditable', false);
      }
      App.config.miscConfigVisibleProperty(miscConfigs, serviceToShow);
    }
    var wizardController = this.get('wizardController');
    if (wizardController.get('name') === "kerberosWizardController")  {
      var kerberosConfigs =  this.get('stepConfigs').findProperty('serviceName', 'KERBEROS').configs;
      kerberosConfigs.findProperty('name', 'kdc_type').set('value', wizardController.get('content.kerberosOption'));
    }
  },

  /**
   * Check whether hive New MySQL database is on the same host as Ambari server MySQL server
   * @return {$.ajax|null}
   * @method checkMySQLHost
   */
  checkMySQLHost: function () {
    // get ambari database type and hostname
    return App.ajax.send({
      name: 'ambari.service',
      data: {
        fields : "?fields=hostComponents/RootServiceHostComponents/properties/server.jdbc.database_name,hostComponents/RootServiceHostComponents/properties/server.jdbc.url"
      },
      sender: this,
      success: 'getAmbariDatabaseSuccess'
    });
  },

  /**
   * Success callback for ambari database, get Ambari DB type and DB server hostname, then
   * Check whether hive New MySQL database is on the same host as Ambari server MySQL server
   * @param {object} data
   * @method getAmbariDatabaseSuccess
   */
  getAmbariDatabaseSuccess: function (data) {
    var hiveDBHostname = this.get('stepConfigs').findProperty('serviceName', 'HIVE').configs.findProperty('name', 'hive_ambari_host').value;
    var ambariServiceHostComponents = data.hostComponents;
    if (!!ambariServiceHostComponents.length) {
      var ambariDBInfo = JSON.stringify(ambariServiceHostComponents[0].RootServiceHostComponents.properties);
      this.set('mySQLServerConflict', ambariDBInfo.indexOf('mysql') > 0 && ambariDBInfo.indexOf(hiveDBHostname) > 0);
    } else {
      this.set('mySQLServerConflict', false);
    }
  },

  /**
   * Check if new MySql database was chosen for Hive service
   * and it is not located on the same host as Ambari server
   * that using MySql database too.
   *
   * @method resolveHiveMysqlDatabase
   **/
  resolveHiveMysqlDatabase: function () {
    var hiveService = this.get('content.services').findProperty('serviceName', 'HIVE');
    if (!hiveService || !hiveService.get('isSelected') || hiveService.get('isInstalled')) {
      this.moveNext();
      return;
    }
    var hiveDBType = this.get('stepConfigs').findProperty('serviceName', 'HIVE').configs.findProperty('name', 'hive_database').value;
    if (hiveDBType == 'New MySQL Database') {
      var self = this;
      this.checkMySQLHost().done(function () {
        if (self.get('mySQLServerConflict')) {
          // error popup before you can proceed
          return App.ModalPopup.show({
            header: Em.I18n.t('installer.step7.popup.mySQLWarning.header'),
            body:Em.I18n.t('installer.step7.popup.mySQLWarning.body'),
            secondary: Em.I18n.t('installer.step7.popup.mySQLWarning.button.gotostep5'),
            primary: Em.I18n.t('installer.step7.popup.mySQLWarning.button.dismiss'),
            onSecondary: function () {
              var parent = this;
              return App.ModalPopup.show({
                header: Em.I18n.t('installer.step7.popup.mySQLWarning.confirmation.header'),
                body: Em.I18n.t('installer.step7.popup.mySQLWarning.confirmation.body'),
                onPrimary: function () {
                  this.hide();
                  parent.hide();
                  // go back to step 5: assign masters and disable default navigation warning
                  App.router.get('installerController').gotoStep(5, true);
                }
              });
            }
          });
        } else {
          self.moveNext();
        }
      });
    } else {
      this.moveNext();
    }
  },

  checkDatabaseConnectionTest: function () {
    var deferred = $.Deferred();
    var configMap = [
      {
        serviceName: 'OOZIE',
        ignored: [Em.I18n.t('installer.step7.oozie.database.new')]
      },
      {
        serviceName: 'HIVE',
        ignored: [Em.I18n.t('installer.step7.hive.database.new.mysql'), Em.I18n.t('installer.step7.hive.database.new.postgres')]
      }
    ];
    configMap.forEach(function (config) {
      var isConnectionNotTested = false;
      var service = this.get('content.services').findProperty('serviceName', config.serviceName);
      if (service && service.get('isSelected') && !service.get('isInstalled')) {
        var serviceConfigs = this.get('stepConfigs').findProperty('serviceName', config.serviceName).configs;
        var serviceDatabase = serviceConfigs.findProperty('name', config.serviceName.toLowerCase() + '_database').get('value');
        if (!config.ignored.contains(serviceDatabase)) {
          var filledProperties = App.db.get('tmp', config.serviceName + '_connection');
          if (!filledProperties || App.isEmptyObject(filledProperties)) {
            isConnectionNotTested = true;
          } else {
            for (var key in filledProperties) {
              if (serviceConfigs.findProperty('name', key).get('value') !== filledProperties[key])
                isConnectionNotTested = true;
            }
          }
        }
      }
      config.isCheckIgnored = isConnectionNotTested;
    }, this);
    var ignoredServices = configMap.filterProperty('isCheckIgnored', true);
    if (ignoredServices.length) {
      var displayedServiceNames = ignoredServices.mapProperty('serviceName').map(function (serviceName) {
        return this.get('content.services').findProperty('serviceName', serviceName).get('displayName');
      }, this);
      this.showDatabaseConnectionWarningPopup(displayedServiceNames, deferred);
    }
    else {
      deferred.resolve();
    }
    return deferred;
  },

  showDatabaseConnectionWarningPopup: function (serviceNames, deferred) {
    var self = this;
    return App.ModalPopup.show({
      header: Em.I18n.t('installer.step7.popup.database.connection.header'),
      body: Em.I18n.t('installer.step7.popup.database.connection.body').format(serviceNames.join(', ')),
      secondary: Em.I18n.t('common.cancel'),
      primary: Em.I18n.t('common.proceedAnyway'),
      onPrimary: function () {
        deferred.resolve();
        this._super();
      },
      onSecondary: function () {
        self.set('submitButtonClicked', false);
        deferred.reject();
        this._super();
      }
    })
  },
  /**
   * Proceed to the next step
   **/
  moveNext: function () {
    App.router.send('next');
  },

  /**
   * Click-handler on Next button
   * Disable "Submit"-button while server-side processes are running
   * @method submit
   */
  submit: function () {
    if (this.get('isSubmitDisabled')) {
      return;
    }
    var self = this;
    this.set('submitButtonClicked', true);
    this.serverSideValidation().done(function () {
      self.checkDatabaseConnectionTest().done(function () {
        self.resolveHiveMysqlDatabase();
        self.set('submitButtonClicked', false);
      });
    }).fail(function (value) {
      if ("invalid_configs" == value) {
        self.set('submitButtonClicked', false);
      } else {
        // Failed due to validation mechanism failure.
        // Should proceed with other checks
        self.checkDatabaseConnectionTest().done(function () {
          self.resolveHiveMysqlDatabase();
          self.set('submitButtonClicked', false);
        });
      }
    });
  },

  toggleIssuesFilter: function () {
    this.get('filterColumns').findProperty('attributeName', 'hasIssues').toggleProperty('selected');
  }
});
