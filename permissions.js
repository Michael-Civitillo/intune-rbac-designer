const PERMISSIONS_DATA = [
  {
    category: "Admin tasks",
    permissions: [
      { action: "Create", description: "Allows creation of new device management administrative tasks" },
      { action: "Delete", description: "Allows deletion of device management administrative tasks" },
      { action: "Read", description: "Allows read access to device management administrative tasks" },
      { action: "Update", description: "Allows updating of device management administrative task properties and status" }
    ]
  },
  {
    category: "Android Enterprise",
    permissions: [
      { action: "Enrollment time device membership assignment", description: "Allows Intune to assign devices to Microsoft Entra ID groups during enrollment." },
      { action: "Read", description: "View the Android Enterprise configuration used to sync applications with the Managed Google Play store or view the Android Enterprise enrollment prerequisites and enrollment profiles." },
      { action: "Update app sync", description: "Manage or change the Managed Google Play configuration used to sync applications with the Managed Google Play store, or sync the apps you approved from the store with Intune." },
      { action: "Update enrollment profiles", description: "Manage or change Android Enterprise Device Owner enrollment profiles used to enroll devices." },
      { action: "Update onboarding", description: "Manage or change the Android Enterprise binding to Managed Google Play and other account-wide configurations." }
    ]
  },
  {
    category: "Android FOTA",
    permissions: [
      { action: "Assign", description: "Assign Android firmware over-the-air (FOTA) deployments to Microsoft Entra security groups." },
      { action: "Create", description: "Create and manage all aspects of Android firmware over-the-air (FOTA) deployments." },
      { action: "Delete", description: "Delete and cancel pending Android firmware over-the-air (FOTA) deployments and delete deployment history." },
      { action: "Read", description: "View Android firmware over-the-air (FOTA) deployments, including history and reporting." },
      { action: "Update", description: "Change existing Android firmware over-the-air (FOTA) deployments and cancel firmware deployments." }
    ]
  },
  {
    category: "App Control for Business",
    permissions: [
      { action: "Assign", description: "Assign App Control for Business profiles to Microsoft Entra security groups." },
      { action: "Create", description: "Create new App Control for Business profiles." },
      { action: "Delete", description: "Delete App Control for Business profiles." },
      { action: "Read", description: "Read App Control for Business profiles." },
      { action: "Update", description: "Update App Control for Business profiles." },
      { action: "View Reports", description: "Generate, view, or export reports for App Control for Business profiles." }
    ]
  },
  {
    category: "Attack Surface Reduction",
    permissions: [
      { action: "Assign", description: "Assign Attack Surface Reduction (ASR) profiles to Microsoft Entra security groups." },
      { action: "Create", description: "Create new Attack Surface Reduction (ASR) profiles." },
      { action: "Delete", description: "Delete Attack Surface Reduction (ASR) profiles." },
      { action: "Read", description: "Read Attack Surface Reduction (ASR) profiles." },
      { action: "Update", description: "Update Attack Surface Reduction (ASR) profiles." },
      { action: "View Reports", description: "Generate, view, or export reports for Attack Surface Reduction (ASR) profiles." }
    ]
  },
  {
    category: "Audit data",
    permissions: [
      { action: "Read", description: "View all Intune audit data for this tenant." }
    ]
  },
  {
    category: "Certificate Connector",
    permissions: [
      { action: "Modify", description: "Add, remove, or modify certificate connectors required to support certificate issuance." },
      { action: "Read", description: "View certificate connectors required to support certificate issuance." }
    ]
  },
  {
    category: "Chrome Enterprise",
    permissions: [
      { action: "Delete connection settings", description: "Delete the organization's Chrome Enterprise connection settings." },
      { action: "Read", description: "View the organization's Chrome Enterprise connection settings and device details for Chrome OS devices." },
      { action: "Update connection settings", description: "Manage or change the organization's Chrome Enterprise connection settings." }
    ]
  },
  {
    category: "Cloud attached devices",
    permissions: [
      { action: "Enroll Now", description: "Enrolls an eligible CM device into comanagement." },
      { action: "Run CMPivot query", description: "Will hide or show the CMPivot blade." },
      { action: "Run script", description: "Will hide or show the Run script action in the Scripts blade." },
      { action: "Take application actions", description: "Will hide or show the actions available in the Applications blade." },
      { action: "View applications", description: "Will hide or show the Applications blade." },
      { action: "View client details", description: "Will hide or show the Client details blade." },
      { action: "View collections", description: "Will hide or show the Collections blade." },
      { action: "View resource explorer", description: "Will hide or show the Resource explorer blade." },
      { action: "View scripts", description: "Will hide or show the Scripts blade." },
      { action: "View software updates", description: "Will hide or show the Software updates blade." },
      { action: "View timeline", description: "Will hide or show the Timeline blade." }
    ]
  },
  {
    category: "Cloud PKI",
    permissions: [
      { action: "Create certificate authorities (CAs)", description: "Create certificate authorities (CAs)" },
      { action: "Disable and reenable CAs", description: "Disable and reenable CAs" },
      { action: "Read CAs", description: "Read CAs and the leaf certificates issued by them" },
      { action: "Revoke issued leaf certificates", description: "Revoke issued leaf certificates" }
    ]
  },
  {
    category: "Corporate device identifiers",
    permissions: [
      { action: "Create", description: "Create new corporate device identifiers or import a CSV file containing a list of corporate device identifiers." },
      { action: "Delete", description: "Delete IMEI or serial numbers used as corporate device identifiers." },
      { action: "Read", description: "View the IMEI or serial numbers used as corporate device identifiers." },
      { action: "Update", description: "Change IMEI or serial numbers used as corporate device identifiers." }
    ]
  },
  {
    category: "Customization",
    permissions: [
      { action: "Assign", description: "Assign customization options for the Company Portal." },
      { action: "Create", description: "Create customization options for the Company Portal." },
      { action: "Delete", description: "Delete customization options for the Company Portal." },
      { action: "Read", description: "Read customization options for the Company Portal." },
      { action: "Update", description: "Update customization options for the Company Portal." }
    ]
  },
  {
    category: "Deployment Plans",
    permissions: [
      { action: "Create", description: "Create Deployment Plans" },
      { action: "Delete", description: "Delete Deployment Plans" },
      { action: "Read", description: "Read Deployment Plans" },
      { action: "Update", description: "Update Deployment Plans" }
    ]
  },
  {
    category: "Derived Credentials",
    permissions: [
      { action: "Modify", description: "Configure the Derived Credentials for your Microsoft Intune tenant." },
      { action: "Read", description: "View the Derived Credentials for your Microsoft Intune tenant." }
    ]
  },
  {
    category: "Device compliance policies",
    permissions: [
      { action: "Assign", description: "Assign device compliance policies to Microsoft Entra security groups, and assign Exchange on-premises access to Microsoft Entra security groups." },
      { action: "Create", description: "Create new device compliance policies." },
      { action: "Delete", description: "Delete device compliance policies or delete Exchange ActiveSync connectors." },
      { action: "Read", description: "View device compliance policies and the list of Exchange Active Sync Connectors, or view the settings for Exchange on-premises access." },
      { action: "Update", description: "Change device compliance policies, Exchange ActiveSync connectors, and Exchange on-premises access settings." },
      { action: "View reports", description: "View, generate, and export device compliance reports." }
    ]
  },
  {
    category: "Device configurations",
    permissions: [
      { action: "Assign", description: "Assign device configuration profiles or assign device enrollment restrictions to Microsoft Entra security groups." },
      { action: "Create", description: "Create new device configuration profiles, or create new device enrollment restrictions." },
      { action: "Delete", description: "Delete device configuration profiles, or delete device enrollment restrictions." },
      { action: "Read", description: "View device configuration profiles, or view device enrollment restrictions." },
      { action: "Update", description: "Change device configuration profiles, or change device enrollment restrictions." },
      { action: "Update Windows Backup and Restore", description: "Change Windows Backup and Restore settings." },
      { action: "View Reports", description: "View, generate, and export device configuration reports." }
    ]
  },
  {
    category: "Device enrollment managers",
    permissions: [
      { action: "Read", description: "View the list of device enrollment manager accounts." },
      { action: "Update", description: "Create new device enrollment manager accounts, or delete device enrollment manager accounts." }
    ]
  },
  {
    category: "Endpoint Analytics",
    permissions: [
      { action: "Create", description: "Create new baselines and edit endpoint analytics settings." },
      { action: "Delete", description: "Edit endpoint analytics settings and delete baselines." },
      { action: "Read", description: "View endpoint analytics scores and performance reports." },
      { action: "Update", description: "Edit endpoint analytics settings and baselines." }
    ]
  },
  {
    category: "Endpoint Detection and Response",
    permissions: [
      { action: "Assign", description: "Assign Endpoint Detection and Response (EDR) profiles to Microsoft Entra security groups." },
      { action: "Create", description: "Create new Endpoint Detection and Response (EDR) profiles." },
      { action: "Delete", description: "Delete Endpoint Detection and Response (EDR) profiles." },
      { action: "Read", description: "Read Endpoint Detection and Response (EDR) profiles." },
      { action: "Update", description: "Update Endpoint Detection and Response (EDR) profiles." },
      { action: "View Reports", description: "Generate, view, or export reports for Endpoint Detection and Response (EDR) profiles." }
    ]
  },
  {
    category: "Endpoint Privilege Management Elevation Requests",
    permissions: [
      { action: "Modify elevation requests", description: "Allows administrators to approve, deny, or revoke Endpoint Privilege Management (EPM) support approved requests from end users." },
      { action: "View elevation requests", description: "Allows administrators to view Endpoint Privilege Management (EPM) support approved requests." }
    ]
  },
  {
    category: "Endpoint Privilege Management Policy Authoring",
    permissions: [
      { action: "Assign", description: "Allows administrators to assign Endpoint Privilege Management (EPM) policies." },
      { action: "Create", description: "Allows administrators to create Endpoint Privilege Management (EPM) policies." },
      { action: "Delete", description: "Allows administrators to delete Endpoint Privilege Management (EPM) policies." },
      { action: "Read", description: "Allows administrators to read Endpoint Privilege Management (EPM) policies." },
      { action: "Update", description: "Allows administrators to update Endpoint Privilege Management (EPM) policies." },
      { action: "View Reports", description: "Allows administrators to view Endpoint Privilege Management (EPM) reports." }
    ]
  },
  {
    category: "Endpoint protection reports",
    permissions: [
      { action: "Read", description: "View endpoint protection reports." }
    ]
  },
  {
    category: "Enrollment programs",
    permissions: [
      { action: "Assign profile", description: "Assign profiles for Automated Device Enrollment, Apple School Manager, Apple Business Manager, Apple Configurator, or Windows Autopilot." },
      { action: "Create device", description: "Import Apple devices for Apple Configurator." },
      { action: "Create profile", description: "Create new profiles for the Automated Device Enrollment, Apple School Manager, Apple Configurator, or Windows Autopilot." },
      { action: "Create token", description: "Download the Apple Automated Device Enrollment or Apple School Manager token .pem file." },
      { action: "Delete device", description: "Delete Apple devices for the Automated Device Enrollment, Apple School Manager, or Apple Configurator." },
      { action: "Delete profile", description: "Delete profiles for the Automated Device Enrollment, Apple School Manager, Apple Configurator, or Windows Autopilot." },
      { action: "Delete token", description: "Delete Apple Automated Device Enrollment or Apple School Manager token .pem files." },
      { action: "Enrollment time device membership assignment", description: "Allows Intune to assign devices to Entra ID groups during enrollment." },
      { action: "Read device", description: "View Apple devices for the Automated Device Enrollment, Apple School Manager, Apple Configurator, or Windows Autopilot devices." },
      { action: "Read profile", description: "View profiles for the Automated Device Enrollment, Apple School Manager, Apple Configurator, or Windows Autopilot." },
      { action: "Read token", description: "View the Apple Automated Device Enrollment or Apple School Manager token status." },
      { action: "Release Apple devices", description: "Release Apple ADE (automated device enrollment) enrolled devices from Apple Business or School Manager and Intune." },
      { action: "Rotate macOS admin password", description: "Rotate local admin account password for macOS devices enrolled through Apple's automated device enrollment." },
      { action: "Sync device", description: "Initiate the Sync command for Windows Autopilot devices." },
      { action: "Update profile", description: "Manage profiles for the Automated Device Enrollment, Apple School Manager, Apple Configurator, or Windows Autopilot." },
      { action: "Update token", description: "Upload the Apple Device Enrollment or Apple School Manager token and sync Apple Automated Device Enrollment or Apple School Manager devices." },
      { action: "View macOS admin password", description: "View local admin account password for macOS devices enrolled through Apple's automated device enrollment." }
    ]
  },
  {
    category: "Filters",
    permissions: [
      { action: "Create", description: "Create new filters for targeting policies and apps to specific devices." },
      { action: "Delete", description: "Delete filters." },
      { action: "Read", description: "View filters." },
      { action: "Update", description: "Edit filters." }
    ]
  },
  {
    category: "Intune data warehouse",
    permissions: [
      { action: "Read", description: "View all data and reports from the data warehouse. Data can be used by Power BI or other reporting services." }
    ]
  },
  {
    category: "Managed apps",
    permissions: [
      { action: "Assign", description: "Assign application protection policies to Microsoft Entra security groups." },
      { action: "Create", description: "Create new application protection policies." },
      { action: "Delete", description: "Delete application protection policies." },
      { action: "Read", description: "View application protection policies and status." },
      { action: "Update", description: "Change application protection policies, or delete pending wipe requests for protected apps." },
      { action: "Wipe", description: "Create a wipe request to selectively remove company data from a protected app." }
    ]
  },
  {
    category: "Managed Device Cleanup Rules",
    permissions: [
      { action: "Update", description: "Change the managed device cleanup rules." }
    ]
  },
  {
    category: "Managed Device Cleanup Settings",
    permissions: [
      { action: "Update", description: "Change the managed device cleanup settings." }
    ]
  },
  {
    category: "Managed devices",
    permissions: [
      { action: "Delete", description: "Delete Intune managed devices. Deleted devices can no longer be managed by Intune, and the device can no longer access company resources. Company data may be wiped from the device if a user tries to check in after it's deleted." },
      { action: "Query", description: "Allows Intune to query a managed device for the purposes of retrieving detailed inventory information, device state, or other properties of a managed device from the device itself." },
      { action: "Read", description: "View Intune managed devices." },
      { action: "Read Bios Password", description: "Read BIOS password for devices with managed BIOS and firmware configuration." },
      { action: "Set primary user", description: "Choose, change, or remove the primary user of a managed device. This permission must be used in combination with the managed devices read and update permissions." },
      { action: "Update", description: "Change settings or ownership properties of a managed device. This permission doesn't enable remote actions for devices. To perform remote actions on the device, grant one or more of the Remote Task permissions." },
      { action: "View reports", description: "Generate, view, or export reports for managed devices." }
    ]
  },
  {
    category: "Managed Google Play",
    permissions: [
      { action: "Modify", description: "Modify the settings for synchronizing Managed Google Play apps with Microsoft Intune." },
      { action: "Read", description: "View the settings for synchronizing Managed Google Play apps with Microsoft Intune." }
    ]
  },
  {
    category: "Microsoft Defender ATP",
    permissions: [
      { action: "Read", description: "View the connection between Microsoft Intune and Microsoft Defender ATP." }
    ]
  },
  {
    category: "Microsoft Store For Business",
    permissions: [
      { action: "Modify", description: "Modify the settings for synchronizing Microsoft Store for Business apps with Microsoft Intune." },
      { action: "Read", description: "View the settings for synchronizing Microsoft Store for Business apps with Microsoft Intune." }
    ]
  },
  {
    category: "Microsoft Tunnel Gateway",
    permissions: [
      { action: "Create", description: "Create Microsoft Tunnel Gateway server configurations and sites. Server configurations include settings for IP address ranges, DNS servers, ports, and split tunneling rules. Sites are logical groupings of multiple servers that support Microsoft Tunnel." },
      { action: "Delete", description: "Delete Microsoft Tunnel Gateway server configurations and sites." },
      { action: "Read", description: "View Microsoft Tunnel Gateway server configurations and sites." },
      { action: "Update", description: "Update Microsoft Tunnel Gateway server configurations and sites." }
    ]
  },
  {
    category: "Mobile apps",
    permissions: [
      { action: "Assign", description: "Assign mobile applications or eBooks to Microsoft Entra security groups." },
      { action: "Create", description: "Add new mobile applications to Intune such as store apps, line-of-business apps, web-links, or built-in apps. You can also add books purchased through the Apple Volume Purchase Program or add eBook categories." },
      { action: "Delete", description: "Delete mobile applications such as store apps, line-of-business apps, web-links, or built-in apps. You can also delete books purchased through the Apple Volume Purchase Program or delete eBook categories." },
      { action: "Read", description: "View mobile applications such as store apps, line-of-business apps, web-links, or built-in apps. You can also view books purchased through the Apple Volume Purchase Program." },
      { action: "Relate", description: "Create relationships with other managed apps using Dependencies and Supersedence features." },
      { action: "Update", description: "Manage mobile applications such as store apps, line-of-business apps, web-links, or built-in apps. The Mobile Applications Create permission may be required for certain application update scenarios." }
    ]
  },
  {
    category: "Mobile Threat Defense",
    permissions: [
      { action: "Modify", description: "Add, remove, or modify the Mobile Threat Defense connectors between Intune and your chosen MTD vendors." },
      { action: "Read", description: "View the Mobile Threat Defense connectors between Intune and your chosen MTD vendors." }
    ]
  },
  {
    category: "Multi Admin Approval",
    permissions: [
      { action: "Approval for Multi Admin Approval", description: "Approve or reject approval requests for Multi Admin Approval configuration." },
      { action: "Create access policy", description: "Create access policies for Multi Admin Approval." },
      { action: "Delete access policy", description: "Delete access policies for Multi Admin Approval." },
      { action: "Read access policy", description: "Read access policies for Multi Admin Approval." },
      { action: "Update access policy", description: "Update access policies for Multi Admin Approval." }
    ]
  },
  {
    category: "Operating System Recovery Configurations",
    permissions: [
      { action: "Assign Profiles", description: "Assign Operating System Recovery profiles." },
      { action: "Create Profiles", description: "Create Operating System Recovery profiles." },
      { action: "Delete Profiles", description: "Delete Operating System Recovery profiles." },
      { action: "Read Profiles", description: "Read Operating System Recovery profiles." },
      { action: "Update Profiles", description: "Update Operating System Recovery profiles." }
    ]
  },
  {
    category: "Organization",
    permissions: [
      { action: "Create", description: "Create tenant settings such as device categories and Exchange connectors." },
      { action: "Delete", description: "Delete tenant settings such as device categories and Exchange Connectors." },
      { action: "Read", description: "View tenant settings such as device categories and Exchange Connectors. This permission is required to activate all enrollment workflows. Also allows viewing the Scoped permissions setting and running the Permissions Assessment Report." },
      { action: "Update", description: "Manage tenant settings, device categories, and Exchange Connectors. Also allows enabling the Scoped permissions setting." }
    ]
  },
  {
    category: "Organizational Messages",
    permissions: [
      { action: "Assign", description: "Assign organizational messages." },
      { action: "Create", description: "Create and assign organizational messages." },
      { action: "Delete", description: "Delete organizational messages." },
      { action: "Read", description: "Read organizational messages." },
      { action: "Update", description: "Cancel organizational messages." },
      { action: "Update organizational message control", description: "Enable or block organizational messages directly from Microsoft, while allowing admin messages to display." }
    ]
  },
  {
    category: "Partner Device Management",
    permissions: [
      { action: "Modify", description: "Configure the Compliance Connector for Jamf." },
      { action: "Read", description: "View the Compliance Connector for Jamf." }
    ]
  },
  {
    category: "Policy Sets",
    permissions: [
      { action: "Assign", description: "Assign Policy Sets to Microsoft Entra security groups." },
      { action: "Create", description: "Create a new Policy Set." },
      { action: "Delete", description: "Delete Policy Sets." },
      { action: "Read", description: "View Policy Sets." },
      { action: "Update", description: "Change a Policy Set, or add items to a Policy Set." }
    ]
  },
  {
    category: "Quiet Time policies",
    permissions: [
      { action: "Assign", description: "Assign quiet time policies to Microsoft Entra security groups." },
      { action: "Create", description: "Create new quiet time policies." },
      { action: "Delete", description: "Delete quiet time policies." },
      { action: "Read", description: "View device quiet time policies." },
      { action: "Update", description: "Change quiet time policies." },
      { action: "View Reports", description: "View, generate, and export quiet time policy reports." }
    ]
  },
  {
    category: "Remote assistance connectors",
    permissions: [
      { action: "Read", description: "View the status of the TeamViewer connector and remote help. This permission isn't required to initiate remote assistance requests for devices." },
      { action: "Update", description: "Manage the state of the TeamViewer connector and remote help. This permission also requires the Remote assistance connectors > Read permission." },
      { action: "View reports", description: "View, generate and export remote help sessions and monitor reports." }
    ]
  },
  {
    category: "Remote Help app",
    permissions: [
      { action: "Elevation", description: "For Windows devices, elevation allows the helper to enter UAC credentials when prompted on the sharer's device when remote help is enabled. Enabling elevation also allows the helper to view and control the sharer's device when the sharer grants the helper access." },
      { action: "Take full control", description: "Take full control allows the helper to view and control the sharer's device when Remote Help is enabled for all platforms we support." },
      { action: "Unattended control", description: "For Android devices, unattended control starts Remote Help as soon as the helper selects a new session, without a sharer having to grant access." },
      { action: "View screen", description: "View screen allows the helper to view the sharer's device when Remote Help is enabled for all platforms we support." }
    ]
  },
  {
    category: "Remote tasks",
    permissions: [
      { action: "Bypass activation lock", description: "Remove the Activation Lock from supervised devices without requiring the user's Apple ID and password. This may be required if a user leaves the company and returns the device." },
      { action: "Change assignments", description: "Allows IT Admin to initiate a change assignments action. Action allows the selection of assigned applications and configuration to be removed from a device." },
      { action: "Clean PC", description: "Initiate a Fresh start device action. This action removes any apps that are installed on a Windows 10 PC that's running the Creators Update. Then, it automatically updates the PC to the latest version of Windows." },
      { action: "Collect diagnostics", description: "Collect device diagnostics." },
      { action: "Disable lost mode", description: "Turn off lost mode for an iOS or ChromeOS device." },
      { action: "Enable lost mode", description: "Initiate lost mode on lost or stolen iOS or ChromeOS devices. This mode lets you enter a message and a phone number that appears on the lock screen of the device. To use lost mode, the device must be a corporate-owned iOS device that is in supervised mode." },
      { action: "Enable Windows IntuneAgent", description: "Enable Windows Intune agent." },
      { action: "Get FileVault key", description: "Get Mac FileVault key." },
      { action: "Initiate MDM attestation", description: "Indicates remote device action to initiate Mobile Device Management (MDM) attestation if device is capable for it." },
      { action: "Initiate Configuration Manager action", description: "Initiate a remote action on a device managed by Configuration Manager." },
      { action: "Locate device", description: "View the location of a lost or stolen corporate-owned device on a map. Can locate supervised iOS/iPadOS devices, Android dedicated devices (COSU), and Windows devices." },
      { action: "Manage shared device users", description: "Sign out the user with the current session on a shared device. This action doesn't delete users from a shared device, it only forces the user with a current session to be logged out." },
      { action: "Offboard", description: "Offboard the devices associated with a user, when the user is leaving the organization." },
      { action: "Offer remote assistance", description: "Initiate a remote assistance session with a user's device by using a remote assistance provider. The remote assistance option for your provider must be enabled for your tenant." },
      { action: "Play sound to locate lost devices", description: "Play a sound to locate lost Android dedicated devices, or iOS devices placed in MDM lost mode." },
      { action: "Reboot now", description: "Initiates a device restart. This causes the device you choose to be restarted. The device owner isn't automatically notified of the restart, and they might lose work." },
      { action: "Recover MDM Key", description: "Initiate Mobile Device Management (MDM) certificate's private key recovery with TPM attestation." },
      { action: "Remote lock", description: "The Remote lock device action locks the device. To unlock the device, the device owner enters their passcode. You can remotely lock devices that have a PIN or password set." },
      { action: "Remove Device Firmware Configuration Interface Management", description: "Allows admin to initiate removal of device from Device Firmware Configuration Interface management before deleting the Intune and Autopilot records." },
      { action: "Reset passcode", description: "Initiates a forced removal of the passcode, and requires the device user to set a new passcode. Supported on iOS devices, and certain later versions of Android and Android for work." },
      { action: "Restore Managed Home Screen", description: "Manually restore Managed Home Screen on Android Enterprise devices to return them to kiosk mode from a temporarily suspended state." },
      { action: "Retire", description: "Initiates a retire action for a device. The Remove company data action removes managed app data (where applicable), settings, and email profiles that were assigned by using Intune. The device is removed from Intune management." },
      { action: "Revoke App Licenses", description: "Revokes any iOS VPP application licenses that have been associated with the device." },
      { action: "Rotate BitLockerKeys (preview)", description: "Initiates a key rotation for BitLocker Recovery Passwords on the device." },
      { action: "Rotate FileVault key", description: "Rotate Mac FileVault key." },
      { action: "Rotate Local Admin Password", description: "Initiates a manual rotation for the local admin password on the device." },
      { action: "Rotate macOS recovery lock password", description: "Rotate the recovery lock password for macOS devices." },
      { action: "Run Pause Configuration Refresh", description: "Initiate On Demand pause configuration refresh." },
      { action: "Run Remediation", description: "Initiate On Demand Proactive Remediation." },
      { action: "Send custom notifications", description: "Allows admin to send customized notifications to devices. Devices receive notifications in Company Portal." },
      { action: "Set device name", description: "Set or change the name of a device." },
      { action: "Shut down", description: "Initiates a shutdown of the device, and will automatically close all applications and running services and leave the device in a powered-off state." },
      { action: "Sync devices", description: "Initiates a sync operation on the device and forces the selected device to immediately check in with Intune. When a device checks in, it immediately receives any pending actions or policies that have been assigned to it." },
      { action: "Temporarily suspend Managed Home Screen", description: "Remotely suspend Managed Home Screen on Android Enterprise devices in kiosk mode, allowing temporary access to the default launcher experience." },
      { action: "Update cellular data plan", description: "Activate the data plan for cellular iOS/iPadOS devices that support eSIM." },
      { action: "Update device account", description: "Allows changing the device account associated with Surface Hub devices, and set authentication options such as password rotation." },
      { action: "View macOS recovery lock password", description: "View the recovery lock password in the Recovery Keys blade of macOS devices." },
      { action: "Windows Defender", description: "Initiates a Windows Defender signature update." },
      { action: "Wipe", description: "Initiates a wipe of the device. Also called a factory reset. The Factory reset action restores a device to its factory default settings. The user data is kept or wiped depending on whether or not you choose the Retain enrollment state and user account checkbox." }
    ]
  },
  {
    category: "Roles",
    permissions: [
      { action: "Assign", description: "Assign Intune built-in or custom roles to Microsoft Entra security groups." },
      { action: "Create", description: "Create new Intune custom roles. Built-in roles are created by Intune automatically." },
      { action: "Delete", description: "Delete a custom Intune role. You can't delete built-in roles." },
      { action: "Read", description: "View permissions, role assignments, member groups, and scope groups for any built-in or custom Intune role." },
      { action: "Update", description: "Update custom role permissions and role assignments for built-in or custom roles. Role assignments define the administrators and end user scope for the role." }
    ]
  },
  {
    category: "Security baselines",
    permissions: [
      { action: "Assign", description: "Assign Security Baseline profiles to Microsoft Entra security groups." },
      { action: "Create", description: "Create new Security Baseline profiles." },
      { action: "Delete", description: "Delete Security Baseline profiles." },
      { action: "Read", description: "View Security Baseline profiles or profiles reporting or Template reporting for all Security Baseline workspace." },
      { action: "Update", description: "Update Security Baseline profiles." }
    ]
  },
  {
    category: "Security tasks",
    permissions: [
      { action: "Read", description: "View security tasks." },
      { action: "Update", description: "Update security tasks." }
    ]
  },
  {
    category: "ServiceNow",
    permissions: [
      { action: "Update Connector", description: "Update ServiceNow connection." },
      { action: "View Incidents", description: "View incidents from ServiceNow." }
    ]
  },
  {
    category: "Telecom expenses",
    permissions: [
      { action: "Read", description: "View settings and status of telecom expense partner connector. Note: this feature was deprecated and this permission is no longer supported after June 2025." },
      { action: "Update", description: "Modify or activate telecom expense management partner connector. Note: this feature is deprecated and no longer supported after June 2025." }
    ]
  },
  {
    category: "Tenant attached recommendations",
    permissions: [
      { action: "Read", description: "View Tenant attached recommendations. Recommendations are methods to improve site health and device management experience." }
    ]
  },
  {
    category: "Terms and conditions",
    permissions: [
      { action: "Assign", description: "Assign terms and conditions to Microsoft Entra security groups." },
      { action: "Create", description: "Create new terms and conditions." },
      { action: "Delete", description: "Delete an existing terms and conditions." },
      { action: "Read", description: "View terms and conditions." },
      { action: "Update", description: "Manage existing terms and conditions but not assignments." }
    ]
  },
  {
    category: "Windows Enterprise Certificate",
    permissions: [
      { action: "Modify", description: "Add, remove, or modify the code-signing certificate used to distribute line-of-business apps to your managed Windows devices." },
      { action: "Read", description: "View the code-signing certificate used to distribute line-of-business apps to your managed Windows devices." }
    ]
  }
];
