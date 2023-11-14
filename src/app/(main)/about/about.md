# Respond Overview
The Respond app is a mission management tool used to communicate mission information and enable responders to sign in to missions so that mission leadership knows how many responders are enroute.

## Home Page
The Home page provides an overview of recent, ongoing, and future activities.

### My Activity
The "My Activity" section contains an abbreviated list of the activities that you are currently involved with. It will only be present if you are currently signed into, or on standby for, an activity.

### Missions
The "Missions" section will contain a list of missions that are currently active, or which concluded within the last 3 days. At present there is no option to view missions that are older than 3 days.

### Events
The "Events" section contains a list of Trainings or other Events that are currently active, or which concluded within the last 3 days. At present there is no option to view Events that are older than 3 days.

## Activity Detail Page
Clicking on any Mission or Event name will take you to a detail page where you can view the roster of everyone who has signed into the mission, view additional mission information, and access tools to edit a mission, or mark it as complete.

The roster shows each responder’s name, the time of their most recent status change, and a color indicator of their current status; At present, green means they are currently signed in, not green means they are on standby or signed out.

### Edit Activity Details
Clicking the Edit Button will open a form that allows you to edit the mission details.

### Mark Activity as Complete
Clicking Complete will mark the mission as completed. Anyone that was still signed into the mission will be signed out and the buttons to set your status for the mission will be hidden.

Activities that are marked "Complete" can be re-opened by clicking "Reactivate"

### Delete an Activity
Clicking the Red delete icon will delete the mission, which removes it from the Home Page.

## Responding to a Mission
![](/about/activity-tile.jpg)  
The primary functionality of Respond is to enable members to sign in and report they are responding to a Mission, Training or other Event. It also provides a way for mission leadership to keep track of the status of responders and see their relevant qualifications. In the future, the timeline events will be used to automate roster entry into the database.

### Signing Into an Activity
By default, the button in each Mission or Event will indicate the expected next action, based on your current status. For example, if you have not signed in yet, or if you are on standby, it will say “Sign In”. Clicking Sign In will sign you into the Mission. Once you are signed in, the button will switch to Sign Out. Clicking it again will sign you out of the mission. Some statuses have a secondary option which appear in a dropdown menu.

### Standby for a Future Activity
Respond allows you to indicate that you are available for a current or future mission, but are not currently responding. Missions that are scheduled to start in the future will default to Stand By; you will not be able to sign into a mission that has not started. To cancel, you can choose Stand Down from the dropdown menu.

## SARTopo Map
The Map Id is expected to be a SARTopo Map Id. Only the Id is required. For example if the Map URL is http://sartopo.com/m/ABC12 then the Id is "ABC12"

When a Map Id has been provided it will be shown as a link on the Mission Detail page and as a button with the SARTopo logo on the Activity tiles, on the home page. Clicking on either the link, or the button will open the map in a new browser tab.

If you are on a mobile device, the map may open in the Caltopo App directly. Based on feedback we have received, Android users may need to give Caltopo permission to open links:

1. Open Settings -> Apps -> CalTopo -> Open by default
1. Tap on "Add Link", then select all 3 options.
1. The app should now open for CalTopo and SARTopo links.