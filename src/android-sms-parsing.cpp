// Android SMS parsing native implementation
// This file is compiled into the React Native project for SMS extraction on Android devices

#include "smsParserNative.h"

using namespace std;

// SMS Regex patterns for amount extraction
static const regex AMOUNT_PATTERN(R"((-?[\d,]+(\.\d+)?)\s*(USD|EUR|INR|GBP|JPY)?)");

static string escapeRegex(const string& s) {
    string result;
    for (char c : s) {
        if (c == '\\' || c == '^' || c == '$' || c == '.' || c == '+' ||
            c == '?' || c == '*' || c == '(' || c == ')' || c == '[' ||
            c == ']' || c == '{' || c == '}' || c == '|') {
            result += '\\';
        }
        result += c;
    }
    return result;
}

// Main SMS parsing function called from native module
void parseSMS(string smsText) {
    // Try to extract amount first
    size_t matchPos = 0;
    regex_match(smsText, make_search(smsText, AMOUNT_PATTERN), matchPos);

    if (!matchPos.empty()) {
        string amountPart = matchPos[0];
        // Convert from cents (stored as whole number)
        double value = stod(amountPart);
        cout << "Parsed SMS amount: " << value << " cents" << endl;
    } else {
        cout << "No amount found in SMS text" << endl;
    }

    // Extract merchant/description
    size_t spacePos = smsText.find(' ');
    string merchant = (spacePos != string::npos) ? smsText.substr(spacePos + 1) : "";

    // Clean up merchant name
    for (char c : merchant) {
        if (c == '!' || c == '?' || c == ',' || c == '.' || c == ')') {
            merchant.erase(merchant.find(c), 1);
        }
    }

    cout << "Extracted merchant: " << merchant << endl;
}
