export const dailyWorkOrderReportPayload = (userId: string, fromDate: string, toDate: string) => ({
  "ExportType": 1,
  "Language": "",
  "RunAsUserID": "",
  "Parameters": [
    {
      "ParameterName": "@Organization",
      "Values": [
        "10"
      ]
    },
    {
      "ParameterName": "@Account",
      "Values": [
        "*ALL"
      ]
    },
    {
      "ParameterName": "@Event",
      "Values": [
        "-1"
      ]
    },
    {
      "ParameterName": "@Department",
      "Values": [
        "*ALL"
      ]
    },
    {
      "ParameterName": "From Date",
      "Values": [
        fromDate
      ]
    },
    {
      "ParameterName": "To Date",
      "Values": [
        toDate
      ]
    },
    {
      "ParameterName": "From Status",
      "Values": [
        "10"
      ]
    },
    {
      "ParameterName": "To Status",
      "Values": [
        "80"
      ]
    },
    {
      "ParameterName": "Coordinators",
      "Values": [
        "*ALL"
      ]
    },
    {
      "ParameterName": "Space Type",
      "Values": [
        "*ALL"
      ]
    },
    {
      "ParameterName": "Notes Type",
      "Values": [
        "1"
      ]
    },
    {
      "ParameterName": "Function Type",
      "Values": [
        "*ALL"
      ]
    },
    {
      "ParameterName": "Function Class",
      "Values": [
        "*ALL"
      ]
    },
    {
      "ParameterName": "EM371 Parm",
      "Values": [
        "ATTENDANCE"
      ]
    },
    {
      "ParameterName": "EM370 Parm",
      "Values": [
        "200"
      ]
    },
    {
      "ParameterName": "@CultureInfo",
      "Values": [
        "en-US"
      ]
    },
    {
      "ParameterName": "@TimeZoneFrom",
      "Values": [
        "Central Standard Time"
      ]
    },
    {
      "ParameterName": "@TimeZoneTo",
      "Values": [
        "Central Standard Time"
      ]
    },
    {
      "ParameterName": "@LongDateFormat",
      "Values": [
        "dddd, MMMM d, yyyy"
      ]
    },
    {
      "ParameterName": "@ShortDateFormat",
      "Values": [
        "MM/dd/yy"
      ]
    },
    {
      "ParameterName": "@TimeFormat",
      "Values": [
        "hh:mm tt"
      ]
    },
    {
      "ParameterName": "@ThousandsFormat",
      "Values": [
        ","
      ]
    },
    {
      "ParameterName": "@DecimalFormat",
      "Values": [
        ","
      ]
    },
    {
      "ParameterName": "@UserID",
      "Values": [
        userId
      ]
    }
  ]
});
