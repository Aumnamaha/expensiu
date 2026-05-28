#ifndef SMS_PARSER_NATIVE_H
#define SMS_PARSER_NATIVE_H

#include <jni.h>
#include <string>

extern "C" {
    // Parse SMS text and extract transaction data
    void parseSMS(jstring smsTextStr);

    // Get parsed amount (in cents)
    jdouble getAmount(jstring amountStr);

    // Set currency preference
    void setCurrency(jstring currencyCode);

    // Detect language from text
    void detectLanguage(jstring textStr);
}

#endif // SMS_PARSER_NATIVE_H
