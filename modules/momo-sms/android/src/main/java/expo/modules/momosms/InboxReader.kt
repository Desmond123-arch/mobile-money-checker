package expo.modules.momosms

import android.content.ContentResolver
import android.provider.Telephony
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class InboxRef(
  @Field val androidId: Long = 0L,
  @Field val receivedAt: Long = 0L,
) : Record

class RawSms(
  @Field val androidId: Long = 0L,
  @Field val sender: String = "",
  @Field val body: String? = null,
  @Field val receivedAt: Long = 0L,
  @Field val isOtp: Boolean = false,
) : Record

internal const val ALLOWED_SENDER = "MobileMoney"
internal const val OTP_PREFIX = "<#>"

// Stays below SQLite's 999 bound-variable limit once the sender argument is added.
internal const val CHUNK_SIZE = 500

/**
 * The only code that touches the SMS provider. Every query carries the sender selection, so a
 * message from any other address is never returned, even for an id that was reused.
 */
internal class InboxReader(private val resolver: ContentResolver) {

  /** (androidId, receivedAt) for every allowed-sender message in the inbox. No bodies are read. */
  fun listIds(): List<InboxRef> {
    val out = ArrayList<InboxRef>()
    val cursor = resolver.query(
      Telephony.Sms.Inbox.CONTENT_URI,
      arrayOf(Telephony.Sms._ID, Telephony.Sms.DATE, Telephony.Sms.ADDRESS),
      "${Telephony.Sms.ADDRESS} LIKE ?",
      arrayOf(ALLOWED_SENDER),
      "${Telephony.Sms._ID} ASC",
    ) ?: return out
    cursor.use {
      val idCol = it.getColumnIndexOrThrow(Telephony.Sms._ID)
      val dateCol = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
      val addressCol = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
      while (it.moveToNext()) {
        if (!isAllowedSender(it.getString(addressCol))) continue
        out.add(InboxRef(it.getLong(idCol), it.getLong(dateCol)))
      }
    }
    return out
  }

  /** Bodies for the given ids. An OTP row has `body = null` and `isOtp = true`. */
  fun readByIds(ids: List<Long>): List<RawSms> {
    val out = ArrayList<RawSms>()
    for (chunk in ids.chunked(CHUNK_SIZE)) {
      val placeholders = chunk.joinToString(",") { "?" }
      val cursor = resolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        arrayOf(Telephony.Sms._ID, Telephony.Sms.DATE, Telephony.Sms.ADDRESS, Telephony.Sms.BODY),
        "${Telephony.Sms.ADDRESS} LIKE ? AND ${Telephony.Sms._ID} IN ($placeholders)",
        arrayOf(ALLOWED_SENDER) + chunk.map { it.toString() },
        "${Telephony.Sms._ID} ASC",
      ) ?: continue
      cursor.use {
        val idCol = it.getColumnIndexOrThrow(Telephony.Sms._ID)
        val dateCol = it.getColumnIndexOrThrow(Telephony.Sms.DATE)
        val addressCol = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
        val bodyCol = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
        while (it.moveToNext()) {
          if (!isAllowedSender(it.getString(addressCol))) continue
          val body = it.getString(bodyCol) ?: ""
          val isOtp = body.startsWith(OTP_PREFIX)
          out.add(
            RawSms(
              androidId = it.getLong(idCol),
              sender = ALLOWED_SENDER,
              body = if (isOtp) null else body,
              receivedAt = it.getLong(dateCol),
              isOtp = isOtp,
            ),
          )
        }
      }
    }
    return out
  }

  // SQL LIKE is ASCII case-insensitive and 'MobileMoney' has no wildcard, so the query is a
  // case-insensitive equality. This second check keeps it exact if the provider ever differs.
  private fun isAllowedSender(address: String?): Boolean =
    address != null && address.equals(ALLOWED_SENDER, ignoreCase = true)
}
